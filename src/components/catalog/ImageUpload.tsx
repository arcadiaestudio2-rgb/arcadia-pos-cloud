import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Image as ImageIcon, X, UploadCloud } from 'lucide-react';

interface ImageUploadProps {
  images: File[];
  onChange: (images: File[]) => void;
  maxFiles?: number;
}

export function ImageUpload({ images, onChange, maxFiles = 3 }: ImageUploadProps) {
  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newImages = [...images, ...acceptedFiles].slice(0, maxFiles);
    onChange(newImages);
  }, [images, onChange, maxFiles]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.jpeg', '.jpg', '.png'] },
    maxFiles: maxFiles - images.length,
    disabled: images.length >= maxFiles,
    multiple: (maxFiles - images.length) > 1
  } as any);

  const removeImage = (index: number) => {
    const newImages = images.filter((_, i) => i !== index);
    onChange(newImages);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Archivos Multimedia ({images.length}/{maxFiles})</label>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {images.map((file, index) => (
          <div key={index} className="relative aspect-square rounded-xl bg-slate-50 border border-slate-100 overflow-hidden group">
            <img 
              src={URL.createObjectURL(file)} 
              alt={`Upload ${index}`} 
              className="w-full h-full object-cover"
            />
            <button 
              onClick={() => removeImage(index)}
              className="absolute top-1 right-1 w-6 h-6 bg-error text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X size={12} />
            </button>
          </div>
        ))}
        
        {images.length < maxFiles && (
          <div 
            {...getRootProps()} 
            className={`aspect-square rounded-xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all ${
              isDragActive ? 'border-primary bg-primary/5' : 'border-slate-200 hover:border-primary/50 hover:bg-slate-50'
            }`}
          >
            <input {...getInputProps()} />
            <UploadCloud size={24} className={isDragActive ? 'text-primary' : 'text-slate-300'} />
            <p className="text-[9px] font-bold text-slate-400 mt-2 uppercase">Subir Foto</p>
          </div>
        )}
      </div>
    </div>
  );
}
