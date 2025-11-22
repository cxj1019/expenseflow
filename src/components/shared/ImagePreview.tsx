'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Image from 'next/image';

export const ImagePreview = ({ src, children }: { src: string; children: React.ReactNode }) => {
    const [isVisible, setIsVisible] = useState(false);
    const [scale, setScale] = useState(1);
    const [rotation, setRotation] = useState(0);
    const [windowPosition, setWindowPosition] = useState({ x: 0, y: 0 });
    const [windowSize, setWindowSize] = useState({ width: 500, height: 600 });
    const [imageOffset, setImageOffset] = useState({ x: 0, y: 0 });
    const [isWindowDragging, setIsWindowDragging] = useState(false);
    const [isImageDragging, setIsImageDragging] = useState(false);
    const [isResizing, setIsResizing] = useState(false);
    const dragStart = useRef({ x: 0, y: 0 });
    const initialSize = useRef({ width: 0, height: 0 });
    const previewRef = useRef<HTMLDivElement>(null);
    const hideTimeout = useRef<NodeJS.Timeout | null>(null);

    const handleMouseEnter = () => {
        if (hideTimeout.current) clearTimeout(hideTimeout.current);
        if (!isVisible) {
            const initialX = window.innerWidth / 2 - windowSize.width / 2;
            const initialY = window.innerHeight / 2 - windowSize.height / 2;
            setWindowPosition({ x: initialX > 0 ? initialX : 0, y: initialY > 0 ? initialY : 0 });
            setScale(1);
            setRotation(0);
            setImageOffset({ x: 0, y: 0 });
        }
        setIsVisible(true);
    };

    const handleMouseLeave = () => {
        if (!isWindowDragging && !isImageDragging && !isResizing) {
            hideTimeout.current = setTimeout(() => {
                setIsVisible(false);
            }, 300);
        }
    };

    const cancelHide = () => {
        if (hideTimeout.current) clearTimeout(hideTimeout.current);
    };

    const handleClose = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsVisible(false);
    };

    const handleZoomIn = useCallback(() => setScale(s => s * 1.2), []);
    const handleZoomOut = useCallback(() => {
        setScale(s => {
            const newScale = s / 1.2;
            if (newScale <= 1) {
                setImageOffset({ x: 0, y: 0 });
                return 1;
            }
            return newScale;
        });
    }, []);

    const handleRotate = () => setRotation(r => (r + 90) % 360);

    const onWindowDragStart = (e: React.MouseEvent<HTMLDivElement>) => {
        if ((e.target as HTMLElement).dataset.resizeHandle || (e.target as HTMLElement).dataset.closeButton) return;
        e.preventDefault();
        setIsWindowDragging(true);
        dragStart.current = { x: e.clientX - windowPosition.x, y: e.clientY - windowPosition.y };
    };

    const onImageDragStart = (e: React.MouseEvent<HTMLImageElement>) => {
        if (scale <= 1) return;
        e.preventDefault();
        e.stopPropagation();
        setIsImageDragging(true);
        dragStart.current = { x: e.clientX - imageOffset.x, y: e.clientY - imageOffset.y };
    };

    const onResizeStart = (e: React.MouseEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsResizing(true);
        dragStart.current = { x: e.clientX, y: e.clientY };
        if (previewRef.current) {
            initialSize.current = { width: previewRef.current.offsetWidth, height: previewRef.current.offsetHeight };
        }
    };

    const onMouseMove = useCallback((e: MouseEvent) => {
        if (isWindowDragging) {
            setWindowPosition({ x: e.clientX - dragStart.current.x, y: e.clientY - dragStart.current.y });
        } else if (isImageDragging) {
            setImageOffset({ x: e.clientX - dragStart.current.x, y: e.clientY - dragStart.current.y });
        } else if (isResizing) {
            const dy = e.clientY - dragStart.current.y;
            setWindowSize({ width: initialSize.current.width + dy, height: initialSize.current.height + dy });
        }
    }, [isWindowDragging, isImageDragging, isResizing]);

    const onMouseUp = useCallback(() => {
        setIsWindowDragging(false);
        setIsImageDragging(false);
        setIsResizing(false);
    }, []);

    useEffect(() => {
        if (isWindowDragging || isImageDragging || isResizing) {
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        }
        return () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };
    }, [isWindowDragging, isImageDragging, isResizing, onMouseMove, onMouseUp]);

    useEffect(() => {
        const previewElement = previewRef.current;
        if (!isVisible || !previewElement) return;
        const handleWheel = (e: WheelEvent) => {
            e.preventDefault();
            if (e.deltaY < 0) handleZoomIn();
            else handleZoomOut();
        };
        previewElement.addEventListener('wheel', handleWheel, { passive: false });
        return () => {
            if (previewElement) previewElement.removeEventListener('wheel', handleWheel);
        };
    }, [isVisible, handleZoomIn, handleZoomOut]);

    return (
        <div onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave} className="inline-block">
            {children}
            {isVisible && (
                <div
                    ref={previewRef}
                    onMouseEnter={cancelHide}
                    className="fixed p-2 bg-white rounded-lg shadow-2xl z-50 flex flex-col"
                    style={{
                        top: windowPosition.y,
                        left: windowPosition.x,
                        width: `${windowSize.width}px`,
                        height: `${windowSize.height}px`,
                        minWidth: '250px',
                        minHeight: '250px',
                    }}
                >
                    <div
                        onMouseDown={onWindowDragStart}
                        className="w-full h-6 bg-gray-100 rounded-t-md mb-2 flex-shrink-0 relative"
                        style={{ cursor: isWindowDragging ? 'grabbing' : 'grab' }}
                    >
                        <button
                            data-close-button="true"
                            onClick={handleClose}
                            className="absolute top-0 right-0 p-1 text-gray-500 hover:text-gray-800 hover:bg-gray-200 rounded-full"
                            style={{ lineHeight: '1rem', height: '1.5rem', width: '1.5rem' }}
                            title="关闭"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                    <div className="overflow-hidden flex-grow relative">
                        <Image
                            onMouseDown={onImageDragStart}
                            src={src}
                            alt="发票预览"
                            layout="fill"
                            objectFit="contain"
                            style={{
                                transform: `translateX(${imageOffset.x}px) translateY(${imageOffset.y}px) scale(${scale}) rotate(${rotation}deg)`,
                                cursor: scale > 1 ? (isImageDragging ? 'grabbing' : 'grab') : 'default',
                                pointerEvents: 'all',
                            }}
                        />
                    </div>
                    <div className="mt-2 flex justify-center items-center space-x-2 bg-gray-50 p-1 rounded-b-md flex-shrink-0">
                        <button onClick={() => handleZoomOut()} title="缩小" className="p-1.5 text-gray-600 rounded hover:bg-gray-200">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" />
                            </svg>
                        </button>
                        <button onClick={() => handleZoomIn()} title="放大" className="p-1.5 text-gray-600 rounded hover:bg-gray-200">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
                            </svg>
                        </button>
                        <button onClick={() => handleRotate()} title="旋转" className="p-1.5 text-gray-600 rounded hover:bg-gray-200">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h5M20 20v-5h-5" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 9a9 9 0 0114.13-6.36L20 4m-6 16a9 9 0 01-14.13-6.36L4 12" />
                            </svg>
                        </button>
                    </div>
                    <div
                        data-resize-handle="true"
                        onMouseDown={onResizeStart}
                        className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize"
                        style={{ zIndex: 1 }}
                    />
                </div>
            )}
        </div>
    );
};
