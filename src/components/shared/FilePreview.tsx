// src/components/shared/FilePreview.tsx

'use client';

import * as Dialog from '@radix-ui/react-dialog';
import Image from 'next/image';
import { useState, ReactNode } from 'react';
import { FaTimes } from 'react-icons/fa';

interface FilePreviewProps {
  src: string;
  children: ReactNode;
}

export const FilePreview = ({ src, children }: FilePreviewProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const isPdf = src.toLowerCase().endsWith('.pdf');

  return (
    <Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
      <Dialog.Trigger asChild>
        {/* 触发区域（即缩略图），点击打开弹窗 */}
        <div className="cursor-pointer transition-opacity hover:opacity-80">
            {children}
        </div>
      </Dialog.Trigger>
      <Dialog.Portal>
        {/* 黑色半透明背景遮罩 */}
        <Dialog.Overlay className="fixed inset-0 bg-black/90 z-[9999] animate-fade-in backdrop-blur-sm" />
        
        {/* 弹窗内容容器 */}
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[10000] w-full max-w-5xl h-[85vh] p-4 outline-none flex flex-col">
            
            {/* 关闭按钮栏 */}
            <div className="flex justify-end mb-2">
                <Dialog.Close asChild>
                    <button className="text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-full p-2 transition-colors">
                        <FaTimes size={24} />
                    </button>
                </Dialog.Close>
            </div>
            
            {/* 内容预览区域 */}
            <div className="flex-1 bg-black/50 rounded-lg overflow-hidden flex items-center justify-center relative">
                {isPdf ? (
                    /* PDF 预览：使用 iframe */
                    <iframe 
                        src={src} 
                        className="w-full h-full bg-white" 
                        title="PDF Preview"
                    />
                ) : (
                    /* 图片预览：使用 Next.js Image */
                    <div className="relative w-full h-full">
                        <Image 
                            src={src} 
                            alt="Preview" 
                            fill 
                            className="object-contain"
                            unoptimized // 关键：防止 Next.js 服务端优化导致移动端加载失败
                        />
                    </div>
                )}
            </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};