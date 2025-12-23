/**
 * 自定义下拉选择框组件
 * 支持固定高度和滚动条
 */
'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

interface CustomSelectOption {
  value: string;
  label: string;
}

interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: string[] | CustomSelectOption[];
  placeholder?: string;
  className?: string;
}

export function CustomSelect({
  value,
  onChange,
  options,
  placeholder = '请选择',
  className = ''
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭下拉框
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // 标准化选项格式
  const normalizedOptions: CustomSelectOption[] = options.map(opt => 
    typeof opt === 'string' ? { value: opt, label: opt } : opt
  );

  const selectedOption = normalizedOptions.find(opt => opt.value === value);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* 选择框按钮 */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white flex items-center justify-between hover:bg-gray-50 transition"
      >
        <span className={selectedOption ? 'text-gray-900' : 'text-gray-500'}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown
          size={16}
          className={`text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {/* 下拉选项列表 */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg overflow-hidden">
          <div className="max-h-60 overflow-y-auto custom-scrollbar">
            {/* 占位选项 */}
            {placeholder && (
              <div
                onClick={() => {
                  onChange('');
                  setIsOpen(false);
                }}
                className={`px-3 py-2 cursor-pointer hover:bg-blue-50 transition ${
                  !value ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-500'
                }`}
              >
                {placeholder}
              </div>
            )}
            
            {/* 选项列表 */}
            {normalizedOptions.map((option) => (
              <div
                key={option.value}
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className={`px-3 py-2 cursor-pointer hover:bg-blue-50 transition ${
                  value === option.value ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-900'
                }`}
              >
                {option.label}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
