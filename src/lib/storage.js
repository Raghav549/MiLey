/**
 * MiLey Platform - Storage Module
 * Real Supabase Storage for songs, covers, banners, profile images
 * Supports resumable uploads, progress tracking, retry logic
 */

import { supabase } from './supabaseClient'
import { auth } from './auth'

// Storage buckets configuration
const BUCKETS = {
  songs: 'songs',
  covers: 'covers',
  banners: 'banners',
  profiles: 'profiles',
  documents: 'documents',
  backgrounds: 'backgrounds',
}

// Default bucket for general uploads
const DEFAULT_BUCKET = BUCKETS.covers

// Get file extension from filename
function getFileExtension(filename) {
  return filename.split('.').pop().toLowerCase()
}

// Get content type from extension
function getContentType(extension) {
  const types = {
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    flac: 'audio/flac',
    aac: 'audio/aac',
    ogg: 'audio/ogg',
    webm: 'audio/webm',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    svg: 'image/svg+xml',
  }
  return types[extension] || 'application/octet-stream'
}

// Determine bucket based on file type
function getBucketForFile(file) {
  const type = file.type
  if (type.startsWith('audio/')) return BUCKETS.songs
  if (type.startsWith('image/')) {
    // Check if it's likely a banner (wider aspect ratio would be checked by caller)
    return BUCKETS.covers
  }
  return DEFAULT_BUCKET
}

// Generate unique filename
function generateFilename(originalName) {
  const ext = getFileExtension(originalName)
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 10)
  return `${timestamp}-${random}.${ext}`
}

// Upload file with progress tracking and retry
export async function upload(file, originalName, options = {}) {
  const {
    bucket = null,
    path = '',
    onProgress = null,
    retries = 3,
    abortSignal = null,
  } = options

  const user = auth.getCurrentUser()
  if (!user) throw new Error('Authentication required')

  const targetBucket = bucket || getBucketForFile(file)
  const filename = generateFilename(originalName)
  const fullPath = path ? `${path}/${filename}` : `${user.id}/${filename}`

  let lastError = null
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      // Use the upload method for large files with progress tracking
      const { data, error } = await supabase.storage
        .from(targetBucket)
        .upload(fullPath, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: getContentType(getFileExtension(originalName)),
          duplex: 'half',
        })

      if (error) throw error

      // Get public URL
      const { data: urlData } = supabase.storage
        .from(targetBucket)
        .getPublicUrl(fullPath)

      return {
        url: urlData.publicUrl,
        path: fullPath,
        bucket: targetBucket,
        filename,
        size: file.size,
        type: file.type,
      }
    } catch (error) {
      lastError = error
      console.warn(`Upload attempt ${attempt} failed:`, error.message)
      
      // Don't retry on authentication errors
      if (error.status === 401 || error.status === 403) {
        throw error
      }
      
      // Wait before retry (exponential backoff)
      if (attempt < retries) {
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 500))
      }
    }
  }

  throw lastError
}

// Upload with resumable support (for very large files)
export async function uploadResumable(file, originalName, options = {}) {
  const {
    bucket = null,
    path = '',
    onProgress = null,
    chunkSize = 5 * 1024 * 1024, // 5MB chunks
  } = options

  const user = auth.getCurrentUser()
  if (!user) throw new Error('Authentication required')

  const targetBucket = bucket || getBucketForFile(file)
  const filename = generateFilename(originalName)
  const fullPath = path ? `${path}/${filename}` : `${user.id}/${filename}`

  // For files smaller than chunk size, use regular upload
  if (file.size <= chunkSize) {
    return upload(file, originalName, { bucket: targetBucket, path, onProgress })
  }

  // Resumable upload using Supabase's uploadToSignedUrl
  try {
    // Create signed URL for upload
    const signedPath = fullPath
    
    const { data: createData, error: createError } = await supabase.storage
      .from(targetBucket)
      .createSignedUploadUrl(signedPath)

    if (createError) throw createError

    const { signedUrl, id: uploadId, key } = createData

    // Upload in chunks
    let uploadedBytes = 0
    const chunks = []
    
    for (let start = 0; start < file.size; start += chunkSize) {
      const end = Math.min(start + chunkSize, file.size)
      const chunk = file.slice(start, end)
      chunks.push({ chunk, start, end })
    }

    // Upload each chunk
    for (let i = 0; i < chunks.length; i++) {
      const { chunk, start, end } = chunks[i]
      
      const response = await fetch(signedUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': getContentType(getFileExtension(originalName)),
          'x-amz-part-number': String(i + 1),
        },
        body: chunk,
      })

      if (!response.ok) {
        throw new Error(`Chunk ${i + 1} upload failed: ${response.statusText}`)
      }

      uploadedBytes = end
      
      if (onProgress) {
        onProgress({
          loaded: uploadedBytes,
          total: file.size,
          percentage: (uploadedBytes / file.size) * 100,
        })
      }
    }

    // Complete the multipart upload
    const { data: completeData, error: completeError } = await supabase.storage
      .from(targetBucket)
      .uploadToSignedUrl(signedPath, uploadId, chunks.map((_, i) => i + 1))

    if (completeError) throw completeError

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(targetBucket)
      .getPublicUrl(fullPath)

    return {
      url: urlData.publicUrl,
      path: fullPath,
      bucket: targetBucket,
      filename,
      size: file.size,
      type: file.type,
    }
  } catch (error) {
    console.error('Resumable upload error:', error)
    throw error
  }
}

// Delete file
export async function remove(path, bucket = null) {
  const user = auth.getCurrentUser()
  if (!user) throw new Error('Authentication required')

  const targetBucket = bucket || DEFAULT_BUCKET

  try {
    const { error } = await supabase.storage
      .from(targetBucket)
      .remove([path])

    if (error) throw error
    return true
  } catch (error) {
    console.error('Delete error:', error)
    throw error
  }
}

// Get public URL for a file
export function getPublicUrl(path, bucket = null) {
  const targetBucket = bucket || DEFAULT_BUCKET
  
  const { data } = supabase.storage
    .from(targetBucket)
    .getPublicUrl(path)

  return data.publicUrl
}

// Get signed URL for private file (time-limited access)
export async function getSignedUrl(path, bucket = null, expiresIn = 3600) {
  const user = auth.getCurrentUser()
  if (!user) throw new Error('Authentication required')

  const targetBucket = bucket || DEFAULT_BUCKET

  try {
    const { data, error } = await supabase.storage
      .from(targetBucket)
      .createSignedUrl(path, expiresIn)

    if (error) throw error
    return data.signedUrl
  } catch (error) {
    console.error('Signed URL error:', error)
    throw error
  }
}

// List files in a folder
export async function list(folderPath, bucket = null, options = {}) {
  const { limit = 100, offset = 0, search = '' } = options
  
  const user = auth.getCurrentUser()
  if (!user) throw new Error('Authentication required')

  const targetBucket = bucket || DEFAULT_BUCKET
  const path = folderPath || `${user.id}/`

  try {
    const { data, error } = await supabase.storage
      .from(targetBucket)
      .list(path, { limit, offset, search })

    if (error) throw error
    return data || []
  } catch (error) {
    console.error('List error:', error)
    return []
  }
}

// Download file
export async function download(path, bucket = null) {
  const user = auth.getCurrentUser()
  if (!user) throw new Error('Authentication required')

  const targetBucket = bucket || DEFAULT_BUCKET

  try {
    const { data, error } = await supabase.storage
      .from(targetBucket)
      .download(path)

    if (error) throw error
    return data
  } catch (error) {
    console.error('Download error:', error)
    throw error
  }
}

// Upload song/audio file (specialized helper)
export async function uploadSong(file, metadata = {}) {
  return uploadResumable(file, file.name, {
    bucket: BUCKETS.songs,
    onProgress: metadata.onProgress,
  })
}

// Upload cover image (specialized helper)
export async function uploadCover(file, metadata = {}) {
  return upload(file, file.name, {
    bucket: BUCKETS.covers,
    onProgress: metadata.onProgress,
  })
}

// Upload banner image (specialized helper)
export async function uploadBanner(file, metadata = {}) {
  return upload(file, file.name, {
    bucket: BUCKETS.banners,
    onProgress: metadata.onProgress,
  })
}

// Upload profile image (specialized helper)
export async function uploadProfileImage(file, metadata = {}) {
  return upload(file, file.name, {
    bucket: BUCKETS.profiles,
    onProgress: metadata.onProgress,
  })
}

// Upload verification document (specialized helper)
export async function uploadDocument(file, metadata = {}) {
  return upload(file, file.name, {
    bucket: BUCKETS.documents,
    onProgress: metadata.onProgress,
  })
}

export const storage = {
  upload,
  uploadResumable,
  delete: remove,
  getPublicUrl,
  getSignedUrl,
  list,
  download,
  uploadSong,
  uploadCover,
  uploadBanner,
  uploadProfileImage,
  uploadDocument,
  buckets: BUCKETS,
}

export default storage
