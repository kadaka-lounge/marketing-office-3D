/** Loopback LLM servers run on the same machine as the Next.js backend. */
export function isLocalEndpoint(value:string):boolean {
 try {const url=new URL(value);return ['http:','https:'].includes(url.protocol)&&['localhost','127.0.0.1','[::1]'].includes(url.hostname);}
 catch {return false;}
}
/** Accept a base URL or a pasted chat URL, while keeping credentials/query visible to validation. */
export function normalizeAIBaseUrl(value:string):string {
 try {
  const url=new URL(value.trim());let pathname=url.pathname.replace(/\/+$/,'');
  pathname=pathname.replace(/\/chat\/completions$/,'');
  if(isLocalEndpoint(url.href)&&['','/api','/api/chat','/api/generate'].includes(pathname))pathname='/v1';
  url.pathname=pathname||'/';return !pathname&&!url.search&&!url.hash?url.href.replace(/\/$/,''):url.href;
 }catch{return value.trim().replace(/\/+$/,'');}
}
