'use client';
import { Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';
export function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => { const saved = document.cookie.split('; ').find(x => x.startsWith('kisanq-theme='))?.split('=')[1]; const next = saved === 'dark'; setDark(next); document.documentElement.classList.toggle('dark', next); }, []);
  function toggle() { const next = !dark; setDark(next); document.documentElement.classList.toggle('dark', next); document.cookie = `kisanq-theme=${next ? 'dark' : 'light'}; Path=/; Max-Age=31536000; SameSite=Lax`; }
  return <button type="button" className="btn" aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'} onClick={toggle}>{dark ? <Sun size={16}/> : <Moon size={16}/>}<span className="hidden sm:inline">{dark ? 'Light' : 'Dark'}</span></button>;
}
