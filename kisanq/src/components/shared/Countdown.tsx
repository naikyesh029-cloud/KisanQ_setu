'use client';
import { useEffect,useState } from 'react';
export function Countdown({deadline}:{deadline:string}){const [label,setLabel]=useState('');useEffect(()=>{const update=()=>{const ms=Date.parse(deadline)-Date.now();if(!Number.isFinite(ms)||ms<=0){setLabel('Offers closed');return}const hours=Math.floor(ms/3_600_000);const minutes=Math.floor(ms%3_600_000/60_000);setLabel(`${hours}h ${minutes}m remaining`)};update();const timer=window.setInterval(update,30_000);return()=>window.clearInterval(timer)},[deadline]);return <span>{label||'Calculating offer deadline…'}</span>}
