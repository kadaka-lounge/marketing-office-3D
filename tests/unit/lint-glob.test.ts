import {expect,it} from 'vitest';
import {createRequire} from 'node:module';
import {mkdtempSync,mkdirSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
const require=createRequire(import.meta.url);
it('keeps the real Next ESLint root directory resolver compatible with the safe glob replacement',async()=>{
 const directory=mkdtempSync(path.join(tmpdir(),'office-lint-glob-'));
 try{
  mkdirSync(path.join(directory,'app-one'));mkdirSync(path.join(directory,'app-two'));writeFileSync(path.join(directory,'app-file'),'not a directory');
  const {getRootDirs}=require(path.join(path.dirname(require.resolve('@next/eslint-plugin-next')),'utils/get-root-dirs.js'));
  expect(getRootDirs({cwd:directory,settings:{}})).toEqual([directory]);
  expect(getRootDirs({cwd:directory,settings:{next:{rootDir:`${directory}/app-*`}}}).map((p:string)=>path.resolve(p)).sort()).toEqual([path.join(directory,'app-one'),path.join(directory,'app-two')]);
  expect(getRootDirs({cwd:directory,settings:{next:{rootDir:[`${directory}/{app-one,app-two}`,`${directory}/missing-*`]}}}).map((p:string)=>path.resolve(p)).sort()).toEqual([path.join(directory,'app-one'),path.join(directory,'app-two')]);
  mkdirSync(path.join(directory,'app-one','pages'));writeFileSync(path.join(directory,'app-one','pages','about.js'),'export default function About() {}');
  const {ESLint}=require('eslint');
  const eslint=new ESLint({overrideConfigFile:true,overrideConfig:{files:['**/*.jsx'],languageOptions:{parserOptions:{ecmaFeatures:{jsx:true}}},plugins:{next:require('@next/eslint-plugin-next')},settings:{next:{rootDir:`${directory}/app-*`}},rules:{'next/no-html-link-for-pages':'error'}}});
  const [result]=await eslint.lintText('<a href="/about">About</a>',{filePath:'compatibility-fixture.jsx'});
  expect(result.messages.some((m:{ruleId:string})=>m.ruleId==='next/no-html-link-for-pages')).toBe(true);
 }finally{rmSync(directory,{recursive:true,force:true});}
});
