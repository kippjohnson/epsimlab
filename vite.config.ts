import { defineConfig } from 'vite';
export default defineConfig({base:'./',server:{proxy:{'/api':{target:'http://127.0.0.1:8787',changeOrigin:false}}},build:{target:'es2022',assetsInlineLimit:1000000},worker:{format:'iife'}});
