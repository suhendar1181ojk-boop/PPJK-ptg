import { useState } from 'react';
import { Check, Copy, Download, FileCode2 } from 'lucide-react';
import codeGsRaw from '../../gas/Code.gs?raw';
import indexHtmlRaw from '../../gas/Index.html?raw';

export function GasDeployView() {
  const [activeFile, setActiveFile] = useState<'code' | 'index'>('code');
  const [copied, setCopied] = useState(false);

  const currentContent = activeFile === 'code' ? codeGsRaw : indexHtmlRaw;
  const currentFilename = activeFile === 'code' ? 'Code.gs' : 'Index.html';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(currentContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const handleDownload = (filename: string, content: string) => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-[#0B2545]">
              Kode Google Apps Script Siap Deploy (2 File)
            </h2>
            <p className="text-xs text-slate-600 mt-0.5">
              Salin atau unduh langsung <span className="font-mono-code font-semibold">Code.gs</span> dan{' '}
              <span className="font-mono-code font-semibold">Index.html</span> ke project Google Apps Script Anda.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => handleDownload('Code.gs', codeGsRaw)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-800 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-[#0B2545]" />
              <span>Unduh Code.gs</span>
            </button>
            <button
              type="button"
              onClick={() => handleDownload('Index.html', indexHtmlRaw)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-800 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-[#F28C28]" />
              <span>Unduh Index.html</span>
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setActiveFile('code')}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold cursor-pointer ${
                activeFile === 'code'
                  ? 'bg-[#0B2545] text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <FileCode2 className="w-3.5 h-3.5" />
              <span>Code.gs</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveFile('index')}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold cursor-pointer ${
                activeFile === 'index'
                  ? 'bg-[#0B2545] text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <FileCode2 className="w-3.5 h-3.5" />
              <span>Index.html</span>
            </button>
          </div>

          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#F28C28] hover:bg-[#D97719] text-white text-xs font-semibold cursor-pointer"
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? `Tersalin (${currentFilename})` : `Salin ${currentFilename}`}</span>
          </button>
        </div>

        <pre className="p-4 rounded-xl bg-[#0B2545] text-slate-100 text-xs font-mono-code overflow-x-auto max-h-[460px] leading-relaxed">
          <code>{currentContent}</code>
        </pre>
      </div>

      {/* Panduan Deploy GAS */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
        <h3 className="text-sm font-bold text-[#0B2545]">
          Panduan Setup &amp; Deploy Google Apps Script
        </h3>
        <ol className="list-decimal list-inside space-y-2 text-xs text-slate-700 leading-relaxed">
          <li>
            Buat Google Spreadsheet baru, buka menu <strong>Extensions &gt; Apps Script</strong>.
          </li>
          <li>
            Tempel isi <strong>Code.gs</strong> ke file <span className="font-mono-code">Code.gs</span>, lalu buat file HTML baru bernama <span className="font-mono-code">Index</span> (<span className="font-mono-code">Index.html</span>) dan tempel seluruh kodenya.
          </li>
          <li>
            Pilih fungsi <strong>setup</strong> di toolbar editor Apps Script lalu klik <strong>Run</strong>. Berikan izin akses (<em>Review permissions &gt; Advanced &gt; Go to project</em>) untuk Google Sheets, Drive, dan MailApp. Fungsi ini otomatis membuat 10 sheet, folder Drive induk, dan user awal <span className="font-mono-code">admin / Admin123!</span>.
          </li>
          <li>
            Jalankan fungsi <strong>installNotificationTrigger</strong> satu kali agar trigger email harian (pukul 07:30) aktif otomatis.
          </li>
          <li>
            Klik <strong>Deploy &gt; New deployment &gt; Web app</strong>, atur <em>Execute as: Me</em> dan <em>Who has access: Anyone</em> (atau sesuai organisasi Google Workspace Anda), lalu klik <strong>Deploy</strong>.
          </li>
        </ol>
      </div>
    </div>
  );
}
