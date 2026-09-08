// Creates a private bootstrap artifact. Applying it never modifies an existing account.
import {mkdir,writeFile} from 'node:fs/promises';
import {randomBytes,randomUUID,createHash} from 'node:crypto';
const local=process.argv.includes('--local');
const email=local?'owner@example.com':'kipp.william.johnson@gmail.com';
const origin=local?'http://127.0.0.1:5173':'https://app.epsimlab.com';
const token=randomBytes(32).toString('hex'),id=randomUUID(),now=Date.now();
const hash=createHash('sha256').update(token).digest('hex');
const sql=`INSERT INTO people(id,email,name,role,status,owner,created_at,updated_at) SELECT '${id}','${email}','${local?'Local Owner':'Kipp Johnson'}','superuser','invited',1,${now},${now} WHERE NOT EXISTS(SELECT 1 FROM people WHERE owner=1 OR email='${email}');
INSERT INTO invitations(id,person_id,token_hash,created_by,created_at) SELECT '${randomUUID()}',id,'${hash}','bootstrap',${now} FROM people WHERE id='${id}' AND status='invited' AND user_id IS NULL;
`;
await mkdir('.auth',{recursive:true,mode:0o700});
const stem='.auth/owner-'+(local?'local':'production');
await writeFile(stem+'.sql',sql,{mode:0o600,flag:'wx'});
await writeFile(stem+'.txt',origin+'/#activate='+token+'\n',{mode:0o600,flag:'wx'});
console.log('Private bootstrap files prepared at '+stem+'.sql and .txt. Apply the SQL once; share the link only with the owner.');
