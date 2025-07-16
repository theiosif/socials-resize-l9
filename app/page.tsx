"use client"

import type React from "react"

import { useState, useRef, useCallback, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Progress } from "@/components/ui/progress"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Upload, X, Download, ImageIcon, Archive, Images } from "lucide-react"
import JSZip from "jszip"

interface ProcessingOptions {
  canvasW: number
  canvasH: number
  blurRadius: number
  overlayOpacity: number
  overlayColor: string
  quality: number
  outerBorder: number
}

export default function InstagramBatchResizer() {
  const [files, setFiles] = useState<File[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [previewUrl, setPreviewUrl] = useState<string>("")

  // Settings - remove extensions from default values
  const [pattern, setPattern] = useState("{stem}_final")
  const [canvasW, setCanvasW] = useState(1080)
  const [canvasH, setCanvasH] = useState(1350)
  const [blurRadius, setBlurRadius] = useState([8])
  const [overlayOpacity, setOverlayOpacity] = useState([80])
  const [overlayColor, setOverlayColor] = useState("#000000")
  const [quality, setQuality] = useState([100])
  const [outerBorder, setOuterBorder] = useState([0])

  // Detect mobile device
  const [isMobile, setIsMobile] = useState(false)
  const [downloadMode, setDownloadMode] = useState<"images" | "archive">("archive")

  useEffect(() => {
    const checkMobile = () => {
      const mobile =
        window.innerWidth < 768 ||
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
      setIsMobile(mobile)
      setDownloadMode(mobile ? "images" : "archive")
    }

    checkMobile()
    window.addEventListener("resize", checkMobile)
    return () => window.removeEventListener("resize", checkMobile)
  }, [])

  // Instagram format presets
  const formatPresets = [
    { name: "Instagram Portrait 4:5", width: 1080, height: 1350 },
    { name: "Insta Square 1:1", width: 1350, height: 1350 },
    { name: "Insta Story 9:16", width: 1080, height: 1920 },
  ]

  const [archiveName, setArchiveName] = useState("resized-images")

  const applyPreset = (preset: { width: number; height: number }) => {
    setCanvasW(preset.width)
    setCanvasH(preset.height)
  }

  const fileInputRef = useRef<HTMLInputElement>(null)
  const previewCanvasRef = useRef<HTMLCanvasElement>(null)

  // Generate preview when settings change
  useEffect(() => {
    generatePreview()
  }, [blurRadius, overlayOpacity, overlayColor, quality, canvasW, canvasH, outerBorder])

  const generatePreview = async () => {
    try {
      const response = await fetch("/sample-image.jpg")
      const blob = await response.blob()
      const bitmap = await createImageBitmap(blob)

      const canvas = previewCanvasRef.current
      if (!canvas) return

      const ctx = canvas.getContext("2d")
      if (!ctx) return

      // Set canvas size for preview (scaled down)
      const scale = 0.2
      canvas.width = canvasW * scale
      canvas.height = canvasH * scale
      ctx.scale(scale, scale)

      // Apply the same processing as the main function
      await processImageToCanvas(bitmap, ctx, {
        canvasW,
        canvasH,
        blurRadius: blurRadius[0],
        overlayOpacity: overlayOpacity[0],
        overlayColor,
        quality: quality[0] / 100,
        outerBorder: outerBorder[0],
      })

      setPreviewUrl(canvas.toDataURL())
    } catch (error) {
      console.error("Preview generation failed:", error)
    }
  }

  const processImageToCanvas = async (
    imgBitmap: ImageBitmap,
    ctx: CanvasRenderingContext2D,
    opts: ProcessingOptions,
  ) => {
    const { canvasW, canvasH, blurRadius, overlayColor, overlayOpacity, outerBorder } = opts

    // Clear canvas
    ctx.clearRect(0, 0, canvasW, canvasH)

    // Draw blurred cover (full canvas)
    ctx.filter = `blur(${blurRadius}px)`
    const ratioCover = Math.max(canvasW / imgBitmap.width, canvasH / imgBitmap.height)
    const wCover = imgBitmap.width * ratioCover
    const hCover = imgBitmap.height * ratioCover
    ctx.drawImage(imgBitmap, (canvasW - wCover) / 2, (canvasH - hCover) / 2, wCover, hCover)

    // Overlay color (full canvas)
    ctx.filter = "none"
    ctx.globalAlpha = overlayOpacity / 100
    ctx.fillStyle = overlayColor
    ctx.fillRect(0, 0, canvasW, canvasH)
    ctx.globalAlpha = 1

    // Draw fitted original with outer border consideration
    const availableW = canvasW - outerBorder * 2
    const availableH = canvasH - outerBorder * 2
    const ratioFit = Math.min(availableW / imgBitmap.width, availableH / imgBitmap.height)
    const wFit = imgBitmap.width * ratioFit
    const hFit = imgBitmap.height * ratioFit
    ctx.drawImage(imgBitmap, (canvasW - wFit) / 2, (canvasH - hFit) / 2, wFit, hFit)
  }

  const processImage = async (imgBitmap: ImageBitmap, opts: ProcessingOptions): Promise<Blob> => {
    const canvas = document.createElement("canvas")
    canvas.width = opts.canvasW
    canvas.height = opts.canvasH
    const ctx = canvas.getContext("2d")!

    await processImageToCanvas(imgBitmap, ctx, opts)

    return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob!), "image/jpeg", opts.quality))
  }

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const droppedFiles = Array.from(e.dataTransfer.files).filter((file) => file.type.startsWith("image/"))
    setFiles((prev) => [...prev, ...droppedFiles])
  }, [])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files).filter((file) => file.type.startsWith("image/"))
      setFiles((prev) => [...prev, ...selectedFiles])
    }
  }

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const clearFiles = () => {
    setFiles([])
  }

  const processImages = async () => {
    if (!files.length) return

    setIsProcessing(true)
    setProgress(0)

    try {
      const processedFiles: { blob: Blob; filename: string }[] = []

      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        const stem = file.name.replace(/\.[^.]+$/, "")
        const filename = pattern.replace("{idx}", (i + 1).toString()).replace("{stem}", stem) + ".jpg"

        try {
          const bitmap = await createImageBitmap(file)
          const blob = await processImage(bitmap, {
            canvasW,
            canvasH,
            blurRadius: blurRadius[0],
            overlayOpacity: overlayOpacity[0],
            overlayColor,
            quality: quality[0] / 100,
            outerBorder: outerBorder[0],
          })
          processedFiles.push({ blob, filename })
        } catch (err) {
          console.error(`Error processing ${file.name}:`, err)
        }

        setProgress(((i + 1) / files.length) * 100)
      }

      // Handle download based on mode and file count
      if (files.length === 1 || downloadMode === "images") {
        // Download individual files
        for (const { blob, filename } of processedFiles) {
          const url = URL.createObjectURL(blob)
          const a = document.createElement("a")
          a.href = url
          a.download = filename
          a.click()
          URL.revokeObjectURL(url)
          // Add small delay between downloads to avoid browser blocking
          if (processedFiles.length > 1) {
            await new Promise((resolve) => setTimeout(resolve, 100))
          }
        }
      } else {
        // Download as archive
        const zip = new JSZip()
        for (const { blob, filename } of processedFiles) {
          zip.file(filename, blob)
        }

        const content = await zip.generateAsync({ type: "blob" })
        const url = URL.createObjectURL(content)
        const a = document.createElement("a")
        a.href = url
        a.download = archiveName + ".zip"
        a.click()
        URL.revokeObjectURL(url)
      }
    } catch (error) {
      console.error("Processing failed:", error)
    } finally {
      setIsProcessing(false)
      setProgress(0)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Instagram Batch Resizer</h1>
          <p className="text-gray-600">Transform your images for Instagram with custom backgrounds and overlays</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* File Selection */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="w-5 h-5" />
                  Select Images
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div
                  className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                    isDragging ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-gray-400"
                  }`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  <ImageIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-lg font-medium text-gray-700 mb-2">Drag and drop images here</p>
                  <p className="text-gray-500 mb-4">or</p>
                  <Button onClick={() => fileInputRef.current?.click()} variant="outline">
                    Browse Files
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </div>

                {files.length > 0 && (
                  <div className="mt-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-medium text-gray-900">Selected Images ({files.length})</h3>
                      <Button onClick={clearFiles} variant="outline" size="sm">
                        Clear All
                      </Button>
                    </div>
                    <div className="max-h-48 overflow-y-auto space-y-2">
                      {files.map((file, index) => (
                        <div key={index} className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
                          <span className="text-sm text-gray-700 truncate flex-1">{file.name}</span>
                          <Button onClick={() => removeFile(index)} variant="ghost" size="sm">
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Controls */}
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <Label>Canvas Size Presets</Label>
                  <div className="grid grid-cols-1 gap-2 mt-2 mb-4">
                    {formatPresets.map((preset, index) => (
                      <Button
                        key={index}
                        variant="outline"
                        size="sm"
                        onClick={() => applyPreset(preset)}
                        className="justify-start text-left"
                      >
                        {preset.name} ({preset.width}×{preset.height})
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="width">Canvas Width</Label>
                    <Input
                      id="width"
                      type="number"
                      value={canvasW}
                      onChange={(e) => setCanvasW(Number.parseInt(e.target.value))}
                      min="1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="height">Canvas Height</Label>
                    <Input
                      id="height"
                      type="number"
                      value={canvasH}
                      onChange={(e) => setCanvasH(Number.parseInt(e.target.value))}
                      min="1"
                    />
                  </div>
                </div>

                <div>
                  <Label>Blur Radius: {blurRadius[0]}px</Label>
                  <Slider value={blurRadius} onValueChange={setBlurRadius} max={20} min={0} step={1} className="mt-2" />
                </div>

                <div>
                  <Label>Overlay Opacity: {overlayOpacity[0]}%</Label>
                  <Slider
                    value={overlayOpacity}
                    onValueChange={setOverlayOpacity}
                    max={100}
                    min={0}
                    step={1}
                    className="mt-2"
                  />
                </div>

                <div>
                  <Label htmlFor="color">Overlay Color</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      id="color"
                      type="color"
                      value={overlayColor}
                      onChange={(e) => setOverlayColor(e.target.value)}
                      className="w-12 h-10 rounded border border-gray-300"
                    />
                    <Input value={overlayColor} onChange={(e) => setOverlayColor(e.target.value)} className="flex-1" />
                  </div>
                </div>

                <div>
                  <Label>JPEG Quality: {quality[0]}%</Label>
                  <Slider value={quality} onValueChange={setQuality} max={100} min={1} step={1} className="mt-2" />
                </div>

                <div>
                  <Label>Outer Border: {outerBorder[0]}px</Label>
                  <Slider
                    value={outerBorder}
                    onValueChange={setOuterBorder}
                    max={Math.floor(0.125 * Math.max(canvasW, canvasH))}
                    min={0}
                    step={1}
                    className="mt-2"
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Preview */}
          <div>
            <div className="sticky top-4 h-full flex flex-col">
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Live Preview</h3>
                <div className="aspect-[4/5] bg-gray-100 rounded-lg overflow-hidden mb-4">
                  <canvas ref={previewCanvasRef} className="w-full h-full object-contain" style={{ display: "none" }} />
                  {previewUrl && (
                    <img
                      src={previewUrl || "/placeholder.svg"}
                      alt="Preview"
                      className="w-full h-full object-contain"
                    />
                  )}
                </div>
                <div className="text-center text-sm text-gray-600 mb-4">
                  {canvasW} × {canvasH} pixels
                </div>
              </div>

              {/* Output Options Card - This will expand to fill remaining space */}
              <Card className="flex-1 flex flex-col">
                <CardHeader>
                  <CardTitle>Output Options</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 flex-1 flex flex-col justify-between">
                  <div className="space-y-4">
                    <div>
                      <Label>Download Mode</Label>
                      <div className="flex items-center space-x-4 mt-2">
                        <button
                          onClick={() => setDownloadMode("images")}
                          disabled={files.length === 1}
                          className={`flex items-center space-x-2 px-3 py-2 rounded-md border transition-colors ${
                            downloadMode === "images" || files.length === 1
                              ? "bg-blue-50 border-blue-200 text-blue-700"
                              : "bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100"
                          } ${files.length === 1 ? "opacity-75" : ""}`}
                        >
                          <Images className="w-4 h-4" />
                          <span className="text-sm">Separate Images</span>
                        </button>
                        <button
                          onClick={() => setDownloadMode("archive")}
                          disabled={files.length === 1}
                          className={`flex items-center space-x-2 px-3 py-2 rounded-md border transition-colors ${
                            downloadMode === "archive" && files.length > 1
                              ? "bg-blue-50 border-blue-200 text-blue-700"
                              : "bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100"
                          } ${files.length === 1 ? "opacity-75" : ""}`}
                        >
                          <Archive className="w-4 h-4" />
                          <span className="text-sm">Single Archive</span>
                        </button>
                      </div>
                      {files.length === 1 && (
                        <p className="text-xs text-gray-500 mt-1">Single image will be downloaded directly</p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="pattern">Naming Pattern</Label>
                      <div className="flex items-center">
                        <Input
                          id="pattern"
                          value={pattern}
                          onChange={(e) => setPattern(e.target.value)}
                          placeholder="{stem}_final"
                          className="rounded-r-none"
                        />
                        <span className="bg-gray-100 text-gray-500 px-3 py-2 border border-l-0 rounded-r-md text-sm">
                          .jpg
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        Use {"{stem}"} for original filename, {"{idx}"} for index
                      </p>
                    </div>

                    {downloadMode === "archive" && files.length > 1 && (
                      <div>
                        <Label htmlFor="archiveName">Archive Name</Label>
                        <div className="flex items-center">
                          <Input
                            id="archiveName"
                            value={archiveName}
                            onChange={(e) => setArchiveName(e.target.value)}
                            placeholder="resized-images"
                            className="rounded-r-none"
                          />
                          <span className="bg-gray-100 text-gray-500 px-3 py-2 border border-l-0 rounded-r-md text-sm">
                            .zip
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="space-y-4 mt-auto">
                    {isProcessing && (
                      <div>
                        <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
                          <span>Processing...</span>
                          <span>{Math.round(progress)}%</span>
                        </div>
                        <Progress value={progress} className="w-full" />
                      </div>
                    )}

                    <Button
                      onClick={processImages}
                      disabled={files.length === 0 || isProcessing}
                      className="w-full bg-red-600 hover:bg-red-700"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      {isProcessing
                        ? "Processing..."
                        : files.length === 1
                          ? "Process Image"
                          : downloadMode === "images"
                            ? `Process ${files.length} Images`
                            : `Process ${files.length} Images (Archive)`}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

        {/* Google Ads Section */}
        <div className="mt-8 w-full">
          <Card>
            <CardContent className="p-6">
              <div className="text-center">
                <p className="text-xs text-gray-500 mb-4">Advertisement</p>
                <div className="bg-gray-100 border-2 border-dashed border-gray-300 rounded-lg p-8 min-h-[200px] flex items-center justify-center">
                  <div className="text-center text-gray-500">
                    <div className="text-4xl mb-2">📢</div>
                    <p className="text-sm font-medium">Google Ads Placeholder</p>
                    <p className="text-xs mt-1">Replace this div with your Google AdSense code</p>
                    <div className="mt-4 text-xs bg-gray-200 rounded px-2 py-1 inline-block font-mono">
                      728x90 Leaderboard or 320x50 Mobile Banner
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Support Section - Full Width */}
        <div className="mt-6 w-full">
          <Card>
            <CardHeader>
              <CardTitle className="text-center">Support This Tool</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-gray-600 text-center">
                If this tool helped you, consider supporting its development!
              </p>
              <div className="flex flex-col sm:flex-row justify-center items-center gap-3 max-w-md mx-auto">
                <Button
                  variant="outline"
                  className="w-full sm:w-auto bg-yellow-50 hover:bg-yellow-100 border-yellow-200"
                  onClick={() => window.open("https://buymeacoffee.com", "_blank")}
                >
                  ☕ Buy me a coffee
                </Button>
                <Button
                  variant="outline"
                  className="w-full sm:w-auto bg-blue-50 hover:bg-blue-100 border-blue-200"
                  onClick={() => window.open("https://paypal.me", "_blank")}
                >
                  💙 PayPal
                </Button>
                <Button
                  variant="outline"
                  className="w-full sm:w-auto bg-purple-50 hover:bg-purple-100 border-purple-200"
                  onClick={() => window.open("https://ko-fi.com", "_blank")}
                >
                  💜 Ko-fi
                </Button>
              </div>
              <p className="text-xs text-gray-500 text-center">
                Every contribution helps keep this tool free and ad-light!
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
