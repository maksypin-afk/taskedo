import React, { useRef, useEffect } from 'react';

interface RichTextEditorProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
}

export const RichTextEditor: React.FC<RichTextEditorProps> = ({ value, onChange, placeholder, className }) => {
    const editorRef = useRef<HTMLDivElement>(null);

    // Sync external value to editor only if it differs from current content
    // to avoid cursor jumping and unnecessary updates
    useEffect(() => {
        if (editorRef.current && editorRef.current.innerHTML !== value) {
            editorRef.current.innerHTML = value || '';
        }
    }, [value]);

    const handleInput = () => {
        if (editorRef.current) {
            onChange(editorRef.current.innerHTML);
        }
    };

    const execCommand = (command: string, value: string = '') => {
        document.execCommand(command, false, value);
        if (editorRef.current) {
            editorRef.current.focus();
            handleInput();
        }
    };

    return (
        <div className={`rich-text-editor-container ${className || ''}`}>
            <div className="rich-text-toolbar">
                <button
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); execCommand('bold'); }}
                    title="Bold"
                    className="toolbar-btn"
                >
                    <strong>B</strong>
                </button>
                <button
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); execCommand('insertUnorderedList'); }}
                    title="Bullet List"
                    className="toolbar-btn"
                >
                    •
                </button>
            </div>
            <div
                ref={editorRef}
                contentEditable
                onInput={handleInput}
                className="rich-text-editor"
                data-placeholder={placeholder}
            />
        </div>
    );
};
