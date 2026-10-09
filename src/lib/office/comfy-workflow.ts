export interface ComfyNode {class_type:string;inputs:Record<string,unknown>;}
export type ComfyGraph=Record<string,ComfyNode>;
export function parseComfyWorkflow(value:string):ComfyGraph{
 if(new TextEncoder().encode(value).length>60000)throw new Error('Workflow maksimal 60 KB.');
 let graph:unknown;try{graph=JSON.parse(value);}catch{throw new Error('Workflow bukan JSON yang valid.');}
 if(!graph||typeof graph!=='object'||Array.isArray(graph)||'nodes' in graph||'links' in graph)throw new Error('Ekspor workflow dengan format API ComfyUI, bukan format canvas.');
 const entries=Object.entries(graph);if(!entries.length||entries.length>500)throw new Error('Workflow harus memiliki 1–500 node API.');
 for(const [id,node] of entries){if(!/^[a-zA-Z0-9_:-]{1,100}$/.test(id)||['__proto__','prototype','constructor'].includes(id)||!node||typeof node!=='object'||typeof node.class_type!=='string'||!node.class_type||node.class_type.length>160||!node.inputs||typeof node.inputs!=='object'||Array.isArray(node.inputs))throw new Error('Node workflow API tidak valid.');}
 return graph as ComfyGraph;
}
export function validateComfyBindings(graph:ComfyGraph,promptNodeId:string,promptInput:string,outputNodeId:string){
 if(!Object.hasOwn(graph,promptNodeId)||typeof graph[promptNodeId].inputs[promptInput]!=='string')throw new Error('Node prompt dan nama input harus menunjuk input teks pada workflow.');
 if(!Object.hasOwn(graph,outputNodeId))throw new Error('Node penyimpan hasil tidak ditemukan pada workflow.');
}
