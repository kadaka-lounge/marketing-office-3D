'use client';
export default function ErrorPage({reset}:{error:Error;reset:()=>void}) {return <main className="loading-page"><div className="brand-mark">k</div><h1>Kantor perlu dimuat ulang</h1><p>Data yang sudah tersimpan tetap aman.</p><button className="button primary" onClick={reset}>Coba lagi</button></main>;}
