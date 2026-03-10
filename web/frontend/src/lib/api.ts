import axios from 'axios'

export const api = axios.create({
  baseURL: '/api',
})

export interface TMDBSearchResult {
  tmdb_id: number
  title: string
  original_title?: string
  overview?: string
  release_date?: string
  rating?: number
  vote_count?: number
  poster_url?: string
  backdrop_url?: string
  genre_ids?: number[]
}

export interface TMDBSearchResponse {
  results: TMDBSearchResult[]
  page: number
  total_pages: number
  total_results: number
}

export interface ArtworkItem {
  id?: number
  movie_id?: number
  source: string
  type: string
  url: string
  language?: string
  likes: number
}

export interface CastCrewMember {
  id?: number
  tmdb_person_id?: number
  name: string
  role: 'cast' | 'crew'
  character_name?: string
  job?: string
  department?: string
  display_order?: number
  profile_path?: string
}

export interface ExternalId {
  source: string
  external_id: string
}

export interface Movie {
  id: number
  tmdb_id: number
  imdb_id?: string
  title: string
  original_title?: string
  overview?: string
  release_date?: string
  runtime?: number
  rating?: number
  vote_count?: number
  tagline?: string
  status: string
  added_at?: string
  genres?: string[]
  cast?: CastCrewMember[]
  crew?: CastCrewMember[]
  artwork?: ArtworkItem[]
  external_ids?: ExternalId[]
  poster_url?: string
}

export interface MovieListResponse {
  movies: Movie[]
  total: number
  page: number
  page_size: number
  pages: number
}

export interface MovieListParams {
  search?: string
  genre?: string
  page?: number
  page_size?: number
}

export function searchTMDB(q: string, page = 1): Promise<TMDBSearchResponse> {
  return api.get('/search', { params: { q, page } }).then((r) => r.data)
}

export function getTMDBMovie(tmdbId: number): Promise<Movie & { in_library: boolean; library_id?: number; fanart?: ArtworkItem[] }> {
  return api.get(`/search/tmdb/${tmdbId}`).then((r) => r.data)
}

export function addMovie(tmdbId: number): Promise<Movie & { already_existed: boolean }> {
  return api.post(`/search/add/${tmdbId}`).then((r) => r.data)
}

export function getMovies(params?: MovieListParams): Promise<MovieListResponse> {
  return api.get('/movies', { params }).then((r) => r.data)
}

export function getMovie(id: number): Promise<Movie> {
  return api.get(`/movies/${id}`).then((r) => r.data)
}

export function deleteMovie(id: number): Promise<{ success: boolean }> {
  return api.delete(`/movies/${id}`).then((r) => r.data)
}

export function refreshArtwork(id: number): Promise<{ success: boolean; artwork: ArtworkItem[] }> {
  return api.get(`/movies/${id}/artwork/refresh`).then((r) => r.data)
}

// ---------------------------------------------------------------------------
// Import types
// ---------------------------------------------------------------------------

export interface ImportPreviewMovie {
  tmdb_id: number | null
  title: string
  year?: number | string | null
  poster_url?: string
}

export interface TMDBListPreview {
  list_name: string
  description: string
  total: number
  movies: ImportPreviewMovie[]
}

export interface TraktPreview {
  total: number
  movies: ImportPreviewMovie[]
}

export interface PlexPreview {
  total: number
  movies: ImportPreviewMovie[]
}

export interface PlexLibrary {
  key: string
  title: string
  type: string
}

export interface ImportResult {
  imported: number
  skipped: number
  failed: number
  errors: string[]
}

export interface ImportProgressEvent {
  type: 'start' | 'progress' | 'done' | 'error'
  total?: number
  current?: number
  title?: string
  status?: 'imported' | 'skipped' | 'failed'
  imported?: number
  skipped?: number
  failed?: number
  elapsed_seconds?: number
  source?: string
  reason?: string
}

export interface ImportSession {
  id: number
  source: string
  source_detail: string
  started_at: string
  finished_at: string | null
  total: number
  imported: number
  skipped: number
  failed: number
}

// ---------------------------------------------------------------------------
// Import API functions
// ---------------------------------------------------------------------------

export function previewTMDBList(listId: string): Promise<TMDBListPreview> {
  return api.get(`/import/tmdb-list/${encodeURIComponent(listId)}`).then((r) => r.data)
}

export function previewTrakt(username: string, listSlug?: string): Promise<TraktPreview> {
  const params: Record<string, string> = { username }
  if (listSlug) params.list_slug = listSlug
  return api.get('/import/trakt/preview', { params }).then((r) => r.data)
}

export interface PlexSavedResult {
  configured: boolean
  plex_url: string
  libraries: PlexLibrary[]
  error?: string
}

export function getPlexSaved(): Promise<PlexSavedResult> {
  return api.get('/import/plex/saved').then((r) => r.data)
}

export function getPlexLibraries(plex_url: string, plex_token: string): Promise<PlexLibrary[]> {
  return api.post('/import/plex/libraries', { plex_url, plex_token }).then((r) => r.data)
}

export function previewPlex(plex_url: string, plex_token: string, section_key: string): Promise<PlexPreview> {
  return api.post('/import/plex/preview', { plex_url, plex_token, section_key }).then((r) => r.data)
}

// Start import jobs (return job_id)
export const startTMDBListImport = (listId: string) =>
  api.post<{ job_id: string; total: number; list_name?: string }>(`/import/tmdb-list/${encodeURIComponent(listId)}/start`).then((r) => r.data)

export const startTraktImport = (username: string, listSlug?: string) =>
  api.post<{ job_id: string; total: number }>('/import/trakt/start', { username, list_slug: listSlug || null }).then((r) => r.data)

export const startPlexImport = (plex_url: string, plex_token: string, section_key: string) =>
  api.post<{ job_id: string; total: number }>('/import/plex/start', { plex_url, plex_token, section_key }).then((r) => r.data)

export const startFolderImport = (folder_path: string, recursive = true) =>
  api.post<{ job_id: string; total: number }>('/import/folder/start', { folder_path, recursive }).then((r) => r.data)

export const previewFolder = (folder_path: string, recursive = true) =>
  api.post<{ total: number; movies: { title: string; year: number | null; filename: string }[] }>('/import/folder/preview', { folder_path, recursive }).then((r) => r.data)

export const getImportSessions = () =>
  api.get<ImportSession[]>('/import/sessions').then((r) => r.data)

// ---------------------------------------------------------------------------
// Settings — API key status
// ---------------------------------------------------------------------------

export interface KeyStatus {
  key: string
  label: string
  required: boolean
  hint: string
  configured: boolean
  masked: string
}

export const getKeyStatus = () =>
  api.get<KeyStatus[]>('/settings/keys').then((r) => r.data)

export const updateKeys = (body: { updates: Record<string, string> }) =>
  api.patch<KeyStatus[]>('/settings/keys', body).then((r) => r.data)
