import {createContext,useContext,useEffect,useState,type ReactNode} from 'react';
import {AccountDialog} from './components/Accounts';
export interface Account {id:string;userId:string;name:string;email:string;phone:string|null;role:'user'|'superuser';effectiveRole:'user'|'superuser';status:string;owner:boolean;mustChangePassword:boolean;previewing:boolean}
interface AuthContext {account:Account|null;ready:boolean;configured:boolean;openAccount:()=>void;refresh:()=>Promise<void>}
const Context=createContext<AuthContext>({account:null,ready:false,configured:false,openAccount:()=>{},refresh:async()=>{}});
export function useAccount(){return useContext(Context);}
export async function api<T=Record<string,unknown>>(path:string,method='GET',body?:unknown):Promise<T>{
 const response=await fetch(path,{method,credentials:'same-origin',headers:method==='GET'?{}:{'Content-Type':'application/json'},...(body!==undefined?{body:JSON.stringify(body)}:{})});
 const data=await response.json().catch(()=>({error:'The account service could not be reached.'}));
 if(!response.ok)throw new Error(data.error||data.message||'This action could not be completed.');return data as T;
}
export function AccountProvider({children}:{children:ReactNode}){
 const [account,setAccount]=useState<Account|null>(null),[ready,setReady]=useState(false),[configured,setConfigured]=useState(false),[open,setOpen]=useState(false);
 const [invitation]=useState(()=>{if(location.hash.startsWith('#activate=')){const token=location.hash.slice(10);history.replaceState(null,'',location.pathname+location.search);return token;}return '';});
 const refresh=async()=>{try{const data=await api<{configured:boolean;account:Account|null}>('/api/identity');setConfigured(data.configured);setAccount(data.account);}catch{/* Offline demo and local studies remain usable. */}finally{setReady(true);}};
 useEffect(()=>{void refresh();const update=()=>void refresh();window.addEventListener('focus',update);return()=>window.removeEventListener('focus',update);},[]);
 const [inviteFinished,setInviteFinished]=useState(false);
 return <Context.Provider value={{account,ready,configured,openAccount:()=>setOpen(true),refresh}}>{children}{ready&&(open||invitation&&!inviteFinished||account?.mustChangePassword)&&<AccountDialog account={account} configured={configured} invitation={inviteFinished?'':invitation} onClose={()=>{setOpen(false);setInviteFinished(true);}} onRefresh={refresh}/>}</Context.Provider>;
}
