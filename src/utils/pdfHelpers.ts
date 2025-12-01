// src/utils/pdfHelpers.ts

export const convertPdfToImage = async (file: File): Promise<Blob> => {
    const pdfjsLib = await import('pdfjs-dist');
  
    // 设置 Worker (指向 public 目录下的文件)
    if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
    }
  
    try {
      const arrayBuffer = await file.arrayBuffer();
      
      // 关键修复：加入 cMapUrl 配置，支持中文标准字体，防止中文乱码或空白
      const loadingTask = pdfjsLib.getDocument({
        data: arrayBuffer,
        cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/cmaps/`,
        cMapPacked: true,
      });
  
      const pdf = await loadingTask.promise;
      const page = await pdf.getPage(1);
      
      // 保持高清晰度 (Scale 3.0)
      const viewport = page.getViewport({ scale: 3.0 });
      
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      canvas.height = viewport.height;
      canvas.width = viewport.width;
  
      if (!context) throw new Error("Canvas context error");
  
      // 绘制白底 (防止透明背景变黑)
      context.fillStyle = '#FFFFFF';
      context.fillRect(0, 0, canvas.width, canvas.height);
  
      await page.render({
        canvasContext: context,
        viewport: viewport,
      }).promise;
  
      return new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error("Canvas to Blob failed"));
        }, 'image/jpeg', 0.9); // 0.9 质量
      });
  
    } catch (error) {
      console.error("PDF Convert Error:", error);
      throw error;
    }
  };