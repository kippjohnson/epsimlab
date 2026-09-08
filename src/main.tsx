import {createRoot} from 'react-dom/client';
import App from './App';
import './styles.css';
import './mobile.css';
import './learning.css';
import './account.css';
import {AccountProvider} from './accounts';
createRoot(document.getElementById('root')!).render(<AccountProvider><App/></AccountProvider>);

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
 window.addEventListener('load',()=>{navigator.serviceWorker.register('./sw.js').catch(()=>{});});
}
