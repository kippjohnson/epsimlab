// Node 26 removed --experimental-transform-types. Use the project's TypeScript
// compiler for the test process on Node 22.15+ and later, without emitted files.
import {registerHooks} from 'node:module';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

registerHooks({
 load(url,context,nextLoad){
  if(!url.endsWith('.ts'))return nextLoad(url,context);
  return {
   format:'module',shortCircuit:true,
   source:ts.transpileModule(readFileSync(new URL(url),'utf8'),{
    compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022},
   }).outputText,
  };
 },
});
