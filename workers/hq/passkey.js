// Face ID / fingerprint login for HQ (WebAuthn passkeys). Only the owner's own devices can be added, and only when already
// logged in. The server stores each device's public key, never anything secret. ES256 only, user verification required.
const enc = new TextEncoder();

export const b64u = {
  enc: (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''),
  dec: (s) => { const t = String(s || '').replace(/-/g, '+').replace(/_/g, '/'); const bin = atob(t + '='.repeat((4 - t.length % 4) % 4)); return Uint8Array.from(bin, c => c.charCodeAt(0)); },
};
export const newChallenge = () => b64u.enc(crypto.getRandomValues(new Uint8Array(32)));

function clientData(b64, type, challenge, origin) {
  let cd; try { cd = JSON.parse(new TextDecoder().decode(b64u.dec(b64))); } catch { return null; }
  return cd && cd.type === type && cd.challenge === challenge && cd.origin === origin && !cd.crossOrigin ? cd : null;
}
const importKey = (spki) => crypto.subtle.importKey('spki', spki, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);

// A new device. The browser sends its public key; we check the challenge and origin and that the key is a real P-256 key.
export async function verifyRegistration({ clientDataJSON, id, publicKey, alg }, { challenge, origin }) {
  if (!clientData(clientDataJSON, 'webauthn.create', challenge, origin)) return null;
  if (alg !== -7 || !id || !publicKey) return null;
  try { await importKey(b64u.dec(publicKey)); } catch { return null; }
  return { id: String(id), publicKey: String(publicKey), signCount: 0 };
}

// ECDSA signatures arrive DER encoded; WebCrypto wants the raw 64 bytes.
export function derToRaw(der) {
  let i = 0;
  if (der[i++] !== 0x30) return null;
  if (der[i] & 0x80) i += (der[i] & 0x7f) + 1; else i++;
  const out = new Uint8Array(64);
  for (let part = 0; part < 2; part++) {
    if (der[i++] !== 0x02) return null;
    let len = der[i++], start = i; i += len;
    while (len > 32 && der[start] === 0) { start++; len--; }
    if (len > 32) return null;
    out.set(der.slice(start, start + len), part * 32 + 32 - len);
  }
  return out;
}

// A login. Returns the new sign count, or null if anything is wrong.
export async function verifyAssertion({ clientDataJSON, authenticatorData, signature }, key, { challenge, origin, rpId }) {
  if (!clientData(clientDataJSON, 'webauthn.get', challenge, origin)) return null;
  const ad = b64u.dec(authenticatorData);
  if (ad.length < 37) return null;
  const rpHash = new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(rpId)));
  if (rpHash.some((b, i) => b !== ad[i])) return null;
  if (!(ad[32] & 0x01) || !(ad[32] & 0x04)) return null; // the person was present and verified (Face ID, fingerprint or phone PIN)
  const count = new DataView(ad.buffer, ad.byteOffset + 33, 4).getUint32(0);
  if ((count || key.signCount) && count <= key.signCount) return null; // a copied or replayed key
  const raw = derToRaw(b64u.dec(signature));
  if (!raw) return null;
  const cdHash = new Uint8Array(await crypto.subtle.digest('SHA-256', b64u.dec(clientDataJSON)));
  const signed = new Uint8Array(ad.length + 32); signed.set(ad); signed.set(cdHash, ad.length);
  let ok = false;
  try { ok = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, await importKey(b64u.dec(key.publicKey)), raw, signed); } catch { ok = false; }
  return ok ? count : null;
}

// The small script both pages use. It runs only with the page's one-time nonce.
export const loginScript = (nonce) => `<script nonce="${nonce}">
(function(){
var b=function(s){s=s.replace(/-/g,'+').replace(/_/g,'/');s+='='.repeat((4-s.length%4)%4);return Uint8Array.from(atob(s),function(c){return c.charCodeAt(0)})};
var u=function(a){return btoa(String.fromCharCode.apply(null,new Uint8Array(a))).replace(/\\+/g,'-').replace(/\\//g,'_').replace(/=+$/,'')};
var post=function(p,d){return fetch(p,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(d||{}),credentials:'same-origin'}).then(function(r){return r.json()})};
var say=function(t){var e=document.getElementById('pk-msg');if(e){e.textContent=t;e.hidden=false}};
var supported=!!(window.PublicKeyCredential&&navigator.credentials);
var login=document.getElementById('pk-login'),add=document.getElementById('pk-add');
if(login){ if(!supported){login.hidden=true} else login.addEventListener('click',function(){
  say('');post('/passkey/options').then(function(o){
    if(!o.challenge)throw new Error(o.error||'x');
    return navigator.credentials.get({publicKey:{challenge:b(o.challenge),rpId:location.hostname,userVerification:'required',timeout:60000}});
  }).then(function(c){
    return post('/passkey/login',{id:c.id,clientDataJSON:u(c.response.clientDataJSON),authenticatorData:u(c.response.authenticatorData),signature:u(c.response.signature)});
  }).then(function(r){if(r.ok){location.href='/'}else{say(r.error||'That did not work. Use your passphrase instead.')}})
  .catch(function(){say('That did not work. Use your passphrase instead.')});
})}
if(add){ if(!supported){say('This browser cannot do Face ID or fingerprint login.');add.hidden=true} else add.addEventListener('click',function(){
  say('');post('/passkey/new-options').then(function(o){
    if(!o.challenge)throw new Error('x');
    return navigator.credentials.create({publicKey:{challenge:b(o.challenge),rp:{name:'Localdesk HQ',id:location.hostname},user:{id:b(o.user),name:'owner',displayName:'Localdesk owner'},pubKeyCredParams:[{type:'public-key',alg:-7}],authenticatorSelection:{residentKey:'required',userVerification:'required'},attestation:'none',timeout:60000}});
  }).then(function(c){
    var r=c.response;if(!r.getPublicKey||r.getPublicKeyAlgorithm()!==-7)throw new Error('x');
    return post('/passkey/register',{id:c.id,clientDataJSON:u(r.clientDataJSON),publicKey:u(r.getPublicKey()),alg:r.getPublicKeyAlgorithm(),name:(document.getElementById('pk-name')||{}).value||''});
  }).then(function(r){if(r.ok){location.href='/passkey?added=1'}else{say(r.error||'That did not work.')}})
  .catch(function(){say('That did not work. Nothing was added.')});
})}
})();
</script>`;
