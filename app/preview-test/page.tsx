'use client';

import React, { useState, useEffect } from 'react';

export default function PreviewTestPage() {
  const [unit1Data, setUnit1Data] = useState<{
    status: number;
    contentType: string | null;
    size: number;
    magic: string;
    objectUrl: string | null;
    error: string | null;
  } | null>(null);

  const [dsdsData, setDsdsData] = useState<{
    status: number;
    contentType: string | null;
    size: number;
    magic: string;
    objectUrl: string | null;
    error: string | null;
  } | null>(null);

  const [downloadAuthStatus, setDownloadAuthStatus] = useState<any>(null);

  useEffect(() => {
    // 1. Test UNIT 1 (PDF)
    async function testUnit1() {
      try {
        const res = await fetch('/api/materials/d178663d-74ad-4779-afec-22d1358ab8b9/preview');
        const ct = res.headers.get('content-type');
        const blob = await res.blob();
        const buf = await blob.slice(0, 10).text();
        const url = URL.createObjectURL(blob);
        setUnit1Data({
          status: res.status,
          contentType: ct,
          size: blob.size,
          magic: buf,
          objectUrl: url,
          error: null,
        });
      } catch (e: any) {
        setUnit1Data({
          status: 0,
          contentType: null,
          size: 0,
          magic: '',
          objectUrl: null,
          error: e.message,
        });
      }
    }

    // 2. Test DSDS
    async function testDsds() {
      try {
        const res = await fetch('/api/materials/d8b71e3c-f90b-45ef-af11-1c41b7cf18af/preview');
        const ct = res.headers.get('content-type');
        const blob = await res.blob();
        const buf = await blob.slice(0, 10).text();
        const url = URL.createObjectURL(blob);
        setDsdsData({
          status: res.status,
          contentType: ct,
          size: blob.size,
          magic: buf,
          objectUrl: url,
          error: null,
        });
      } catch (e: any) {
        setDsdsData({
          status: 0,
          contentType: null,
          size: 0,
          magic: '',
          objectUrl: null,
          error: e.message,
        });
      }
    }

    // 3. Test Download Endpoint & Settings
    async function testDownloadAuth() {
      try {
        const setRes = await fetch('/api/admin/settings');
        const setData = await setRes.json();
        const dldRes = await fetch('/api/materials/d178663d-74ad-4779-afec-22d1358ab8b9/download?json=true');
        const dldData = await dldRes.json();

        setDownloadAuthStatus({
          settings: setData,
          downloadResponseStatus: dldRes.status,
          downloadResponse: dldData,
        });
      } catch (e: any) {
        setDownloadAuthStatus({ error: e.message });
      }
    }

    testUnit1();
    testDsds();
    testDownloadAuth();
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6 max-w-7xl mx-auto space-y-8 font-sans">
      <div className="border-b border-slate-800 pb-4">
        <h1 className="text-2xl font-bold text-amber-400">Diagnosis & Diagnostic Self-Test (/preview-test)</h1>
        <p className="text-xs text-slate-400 mt-1">
          Testing REAL Supabase storage items directly with authorized binary streaming and native renderers.
        </p>
      </div>

      {/* Grid: UNIT 1 and DSDS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Test 1: UNIT 1 */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-sm text-white">1. UNIT 1 (PDF Test)</h2>
            <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300">
              ID: d178663d-74ad...
            </span>
          </div>

          {unit1Data ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
                <div className="bg-slate-950 p-2 rounded border border-slate-800">
                  <span className="text-slate-500 block">HTTP</span>
                  <span className={unit1Data.status === 200 ? 'text-emerald-400 font-bold' : 'text-rose-400'}>
                    {unit1Data.status}
                  </span>
                </div>
                <div className="bg-slate-950 p-2 rounded border border-slate-800">
                  <span className="text-slate-500 block">Content-Type</span>
                  <span className="text-amber-300 truncate block">{unit1Data.contentType}</span>
                </div>
                <div className="bg-slate-950 p-2 rounded border border-slate-800">
                  <span className="text-slate-500 block">Blob Size</span>
                  <span className="text-slate-200">{Math.round(unit1Data.size / 1024)} KB</span>
                </div>
                <div className="bg-slate-950 p-2 rounded border border-slate-800">
                  <span className="text-slate-500 block">Magic Bytes</span>
                  <span className="text-cyan-300 truncate block">{unit1Data.magic}</span>
                </div>
              </div>

              {/* Native Object / Embed PDF Render Viewport */}
              {unit1Data.objectUrl ? (
                <div className="space-y-2">
                  <span className="text-xs font-semibold text-slate-300">Browser Native PDF Viewport:</span>
                  <div className="h-96 w-full bg-white rounded-xl overflow-hidden border border-slate-700">
                    <object
                      data={unit1Data.objectUrl}
                      type="application/pdf"
                      className="w-full h-full"
                    >
                      <iframe
                        src={`${unit1Data.objectUrl}#toolbar=0`}
                        title="UNIT 1 PDF"
                        className="w-full h-full border-0"
                      />
                    </object>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-rose-950/40 border border-rose-800 rounded-xl text-rose-300 text-xs">
                  Failed: {unit1Data.error}
                </div>
              )}
            </div>
          ) : (
            <div className="py-8 text-center text-xs text-slate-500">Fetching UNIT 1 preview...</div>
          )}
        </div>

        {/* Test 2: DSDS */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-sm text-white">2. DSDS (PDF Test)</h2>
            <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300">
              ID: d8b71e3c-f90b...
            </span>
          </div>

          {dsdsData ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
                <div className="bg-slate-950 p-2 rounded border border-slate-800">
                  <span className="text-slate-500 block">HTTP</span>
                  <span className={dsdsData.status === 200 ? 'text-emerald-400 font-bold' : 'text-rose-400'}>
                    {dsdsData.status}
                  </span>
                </div>
                <div className="bg-slate-950 p-2 rounded border border-slate-800">
                  <span className="text-slate-500 block">Content-Type</span>
                  <span className="text-amber-300 truncate block">{dsdsData.contentType}</span>
                </div>
                <div className="bg-slate-950 p-2 rounded border border-slate-800">
                  <span className="text-slate-500 block">Blob Size</span>
                  <span className="text-slate-200">{Math.round(dsdsData.size / 1024)} KB</span>
                </div>
                <div className="bg-slate-950 p-2 rounded border border-slate-800">
                  <span className="text-slate-500 block">Magic Bytes</span>
                  <span className="text-cyan-300 truncate block">{dsdsData.magic}</span>
                </div>
              </div>

              {/* Native Object / Embed PDF Render Viewport */}
              {dsdsData.objectUrl ? (
                <div className="space-y-2">
                  <span className="text-xs font-semibold text-slate-300">Browser Native PDF Viewport:</span>
                  <div className="h-96 w-full bg-white rounded-xl overflow-hidden border border-slate-700">
                    <object
                      data={dsdsData.objectUrl}
                      type="application/pdf"
                      className="w-full h-full"
                    >
                      <iframe
                        src={`${dsdsData.objectUrl}#toolbar=0`}
                        title="DSDS PDF"
                        className="w-full h-full border-0"
                      />
                    </object>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-rose-950/40 border border-rose-800 rounded-xl text-rose-300 text-xs">
                  Failed: {dsdsData.error}
                </div>
              )}
            </div>
          ) : (
            <div className="py-8 text-center text-xs text-slate-500">Fetching DSDS preview...</div>
          )}
        </div>

      </div>

      {/* Test 3: Download & Settings Status */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
        <h2 className="font-bold text-sm text-white">3. Download Authorization & Global Setting</h2>
        <pre className="bg-slate-950 p-4 rounded-xl text-xs font-mono text-slate-300 overflow-auto max-h-60 border border-slate-800">
          {JSON.stringify(downloadAuthStatus, null, 2)}
        </pre>
      </div>
    </div>
  );
}
