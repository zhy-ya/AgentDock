import { Save, FileText } from "lucide-react";
import { Btn } from "./ui";

export function FileEditor({
  selectedFile,
  fileContent,
  dirty,
  onSave,
  onContentChange,
}: {
  selectedFile: string;
  fileContent: string;
  dirty: boolean;
  onSave: () => void;
  onContentChange: (value: string) => void;
}) {
  if (!selectedFile) {
    return (
      <div className="glass rounded-2xl shadow-sm flex-1 flex flex-col items-center justify-center min-h-[300px] text-gray-400 gap-2">
        <FileText size={40} strokeWidth={1} className="opacity-30" />
        <p className="text-sm">请在左侧选择文件</p>
      </div>
    );
  }

  return (
    <div className="glass rounded-2xl shadow-sm flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-black/5 gap-3">
        <p className="text-sm font-semibold">
          source/{selectedFile}
          {dirty && <span className="text-red-500 ml-1">*</span>}
        </p>
        <Btn sm primary onClick={onSave}>
          <Save size={12} /> 保存
        </Btn>
      </div>
      <textarea
        className="code-editor-textarea"
        value={fileContent}
        onChange={(e) => onContentChange(e.target.value)}
      />
    </div>
  );
}
