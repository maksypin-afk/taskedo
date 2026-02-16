import React, { useState, useRef, useEffect } from 'react';

interface Option {
    value: string;
    label: string;
}

interface CustomSelectProps {
    value: string;
    onChange: (value: string) => void;
    options: Option[];
    placeholder?: string;
    className?: string;
}

export const CustomSelect: React.FC<CustomSelectProps> = ({
    value,
    onChange,
    options,
    placeholder = 'Select...',
    className = ''
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const selectedOption = options.find(opt => opt.value === value);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    return (
        <div
            className="custom-select-container"
            ref={containerRef}
            style={{ position: 'relative', width: '100%' }}
        >
            <div
                className={`input-field custom-select-trigger ${isOpen ? 'open' : ''} ${className}`}
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    userSelect: 'none'
                }}
            >
                <span style={{ color: selectedOption ? 'var(--color-text-primary)' : 'var(--color-text-muted)' }}>
                    {selectedOption ? selectedOption.label : placeholder}
                </span>
                <span style={{
                    transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.2s ease',
                    opacity: 0.7
                }}>
                    ▼
                </span>
            </div>

            {isOpen && (
                <>
                    <style>{`
                        .custom-select-options::-webkit-scrollbar { width: 6px; }
                        .custom-select-options::-webkit-scrollbar-track { background: transparent; }
                        .custom-select-options::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.2); border-radius: 3px; }
                        .custom-select-options::-webkit-scrollbar-thumb:hover { background: rgba(255, 255, 255, 0.4); }
                    `}</style>
                    <div
                        className="custom-select-options"
                        style={{
                            position: 'absolute',
                            top: 'calc(100% + 4px)',
                            left: 0,
                            right: 0,
                            zIndex: 100,
                            maxHeight: '240px',
                            overflowY: 'auto',
                            padding: '4px',
                            border: '1px solid var(--color-border)',
                            backgroundColor: '#1f2937', // Solid dark background
                            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5), 0 4px 6px -2px rgba(0, 0, 0, 0.3)',
                            borderRadius: '0.5rem'
                        }}
                    >
                        {options.map(option => (
                            <div
                                key={option.value}
                                className={`custom-select-option ${value === option.value ? 'selected' : ''}`}
                                onClick={() => {
                                    onChange(option.value);
                                    setIsOpen(false);
                                }}
                                style={{
                                    padding: '10px 12px',
                                    cursor: 'pointer',
                                    borderRadius: '6px',
                                    color: value === option.value ? '#818cf8' : '#e5e7eb',
                                    fontWeight: value === option.value ? 600 : 400,
                                    background: value === option.value ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                                    transition: 'background 0.15s ease, color 0.15s ease'
                                }}
                                onMouseEnter={(e) => {
                                    if (value !== option.value)
                                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                                }}
                                onMouseLeave={(e) => {
                                    if (value !== option.value)
                                        e.currentTarget.style.background = 'transparent';
                                }}
                            >
                                {option.label}
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
};
