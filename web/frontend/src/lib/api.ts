import axios from 'axios'

const api = axios.create({
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
