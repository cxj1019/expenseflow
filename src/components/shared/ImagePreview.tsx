// src/components/shared/ImagePreview.tsx
'use client';

import * as Dialog from '@radix-ui/react-dialog';
import Image from 'next/image';
import { useState, ReactNode } from 'react';
import { FaTimes, FaSearchPlus } from 'react-icons/fa';

interface ImagePreviewProps {
  src: string;
  children: ReactNode;
}

export const ImagePreview = ({ src, children }: ImagePreviewProps) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
      <Dialog.Trigger asChild>
        {children}
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/80 z-50 animate-fade-in" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 max-w-4xl w-full max-h-screen p-4 outline-none">
            <div className="relative w-full h-auto flex justify-center items-center">
                {/* 关闭按钮 */}
                <Dialog.Close asChild>
                    <button className="absolute -top-10 right-0 text-white hover:text-gray-300 p-2">
                        <FaTimes size={24} />
                    </button>
                </Dialog.Close>
                
                {/* 预览大图 */}
                <div className="relative w-full h-[80vh] bg-black/50 rounded-lg overflow-hidden flex items-center justify-center">
                    <Image 
                        src={src} 
                        alt="Preview" 
                        fill 
                        className="object-contain"
                        // 🔴 关键修复：这里必须加上 unoptimized，防止服务器端优化失败
                        unoptimized
                    />
                </div>
            </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};