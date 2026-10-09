import type { Agent, Division } from './types';
export const DIVISIONS: Division[] = [
 {id:'manager',name:'Marketing Manager',subtitle:'Keputusan & persetujuan',color:'#866747',tint:'#f4ede1'},
 {id:'marketing',name:'Digital Marketing',subtitle:'Strategi & copywriting',color:'#439170',tint:'#eaf3eb'},
 {id:'design',name:'Graphic Design',subtitle:'Identitas & visual kreatif',color:'#9380b5',tint:'#f0ecf7'},
 {id:'analytics',name:'Data Analyst',subtitle:'Riset & performa',color:'#648da7',tint:'#eaf1f7'},
 {id:'publisher',name:'Publisher',subtitle:'Editorial & distribusi',color:'#c28b60',tint:'#fbefe3'}
];
export const AGENTS: Agent[] = [
 {id:'manager',name:'Anda',role:'Marketing Manager',division:'manager',avatarIndex:0,status:'idle',color:'#866747'},
 {id:'maya',name:'Maya',role:'Marketing Strategist',division:'marketing',avatarIndex:1,status:'idle',color:'#439170'},
 {id:'rio',name:'Rio',role:'Copywriter',division:'marketing',avatarIndex:2,status:'idle',color:'#439170'},
 {id:'luna',name:'Luna',role:'Art Director',division:'design',avatarIndex:3,status:'idle',color:'#9380b5'},
 {id:'pixel',name:'Pixel',role:'Visual Designer',division:'design',avatarIndex:4,status:'idle',color:'#9380b5'},
 {id:'atlas',name:'Atlas',role:'Research Analyst',division:'analytics',avatarIndex:5,status:'idle',color:'#648da7'},
 {id:'nova',name:'Nova',role:'Performance Analyst',division:'analytics',avatarIndex:6,status:'idle',color:'#648da7'},
 {id:'cleo',name:'Cleo',role:'Content Editor',division:'publisher',avatarIndex:7,status:'idle',color:'#c28b60'},
 {id:'kai',name:'Kai',role:'Publishing Coordinator',division:'publisher',avatarIndex:8,status:'idle',color:'#c28b60'}
];
export const CHANNELS=['Instagram','LinkedIn','TikTok','Website / Blog'];
export const divisionById = (id:string) => DIVISIONS.find(d=>d.id===id) ?? DIVISIONS[0];
