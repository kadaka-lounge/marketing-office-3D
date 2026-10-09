/** Loopback LLM servers run on the same machine as the Next.js backend. */
export function isLocalEndpoint(value:string):boolean {
 try {const url=new URL(value);return ['http:','https:'].includes(url.protocol)&&['localhost','127.0.0.1','[::1]'].includes(url.hostname);}
 catch {return false;}
}
