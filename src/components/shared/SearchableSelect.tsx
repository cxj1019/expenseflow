// src/components/shared/SearchableSelect.tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import { pinyin } from 'pinyin-pro';

type SearchableOption = {
  id: number | string;
  name: string | null;
};

interface SearchableSelectProps {
  options: SearchableOption[];
  value: string;
  onChange: (newValue: string) => void;
  placeholder?: string;
}

export const SearchableSelect = ({ options, value, onChange, placeholder }: SearchableSelectProps) => {
    // ... 将 page.tsx 中 SearchableSelect 的完整代码粘贴到这里 ...
    const [query, setQuery] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const filteredOptions = query === '' ? options : options.filter(option => { const name = option.name || ''; const lowerCaseQuery = query.toLowerCase(); return ( name.toLowerCase().includes(lowerCaseQuery) || pinyin(name, { toneType: 'none' }).replace(/\s/g, '').toLowerCase().includes(lowerCaseQuery) || pinyin(name, { pattern: 'first', toneType: 'none' }).replace(/\s/g, '').toLowerCase().includes(lowerCaseQuery) ); });
    const handleSelect = (optionName: string) => { onChange(optionName); setQuery(''); setIsOpen(false); };
    useEffect(() => { const handleClickOutside = (event: MouseEvent) => { if (containerRef.current && !containerRef.current.contains(event.target as Node)) { setIsOpen(false); setQuery(''); } }; document.addEventListener('mousedown', handleClickOutside); return () => document.removeEventListener('mousedown', handleClickOutside); }, []);

    return ( <div className="relative" ref={containerRef}> <input type="text" value={isOpen ? query : value} onInput={(e) => {setQuery(e.currentTarget.value); if(!isOpen) setIsOpen(true);}} onFocus={() => setIsOpen(true)} placeholder={placeholder} className="mt-1 block w-full px-3 py-2 border border-gray-300 bg-white rounded-md shadow-sm" /> {isOpen && ( <ul className="absolute z-10 w-full bg-white border border-gray-300 rounded-md mt-1 max-h-60 overflow-y-auto shadow-lg"> {filteredOptions.length > 0 ? ( filteredOptions.map(option => ( <li key={option.id} onClick={() => handleSelect(option.name || '')} className="px-3 py-2 cursor-pointer hover:bg-gray-100"> {option.name} </li> )) ) : ( <li className="px-3 py-2 text-gray-500">无匹配项</li> )} </ul> )} </div> );
};