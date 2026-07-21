/**
 * 系统声音模板（与 Web 端保持一致）
 */
export interface VoiceTemplate {
  id: string
  nameZh: string
  nameEn: string
  gender: 'Male' | 'Female'
  styleZh: string
  styleEn: string
}

export const voiceTemplates: VoiceTemplate[] = [
  // 中文女声
  { id: 'female-professional', nameZh: 'Sarah 晓晓（专业女主播）', nameEn: 'Sarah (Professional Female Host)', gender: 'Female', styleZh: 'professional', styleEn: 'professional' },
  { id: 'female-friendly', nameZh: 'Emma 晓伊（友好亲切）', nameEn: 'Emma (Friendly & Warm)', gender: 'Female', styleZh: 'friendly', styleEn: 'friendly' },
  { id: 'female-northeast', nameZh: 'Beibei 小北（东北话）', nameEn: 'Beibei (Northeast Dialect)', gender: 'Female', styleZh: 'northeast', styleEn: 'northeast dialect' },
  { id: 'female-shaanxi', nameZh: 'Nini 小妮（陕西话）', nameEn: 'Nini (Shaanxi Dialect)', gender: 'Female', styleZh: 'shaanxi', styleEn: 'shaanxi dialect' },
  // 中文男声
  { id: 'male-narrator', nameZh: 'David 云希（经典叙述）', nameEn: 'David (Classic Narration)', gender: 'Male', styleZh: 'narrator', styleEn: 'narrator' },
  { id: 'male-deep', nameZh: 'James 云健（低沉磁性）', nameEn: 'James (Deep & Magnetic)', gender: 'Male', styleZh: 'deep', styleEn: 'deep' },
  { id: 'male-sunny', nameZh: 'Tom 云扬（阳光活力）', nameEn: 'Tom (Sunny & Energetic)', gender: 'Male', styleZh: 'sunny', styleEn: 'sunny' },
  { id: 'male-youth', nameZh: 'Leo 云夏（青春少年）', nameEn: 'Leo (Youthful Boy)', gender: 'Male', styleZh: 'youth', styleEn: 'youth' },
  // 英文女声
  { id: 'en-female-jenny', nameZh: 'Jenny (US English)', nameEn: 'Jenny (US English)', gender: 'Female', styleZh: 'English - friendly', styleEn: 'English - friendly' },
  { id: 'en-female-ariana', nameZh: 'Aria (US English)', nameEn: 'Aria (US English)', gender: 'Female', styleZh: 'English - professional', styleEn: 'English - professional' },
  { id: 'en-female-sarah', nameZh: 'Sarah (UK English)', nameEn: 'Sarah (UK English)', gender: 'Female', styleZh: 'English - British', styleEn: 'English - British' },
  // 英文男声
  { id: 'en-male-guy', nameZh: 'Guy (US English)', nameEn: 'Guy (US English)', gender: 'Male', styleZh: 'English - warm', styleEn: 'English - warm' },
  { id: 'en-male-ryan', nameZh: 'Ryan (US English)', nameEn: 'Ryan (US English)', gender: 'Male', styleZh: 'English - energetic', styleEn: 'English - energetic' },
  { id: 'en-male-james', nameZh: 'James (UK English)', nameEn: 'James (UK English)', gender: 'Male', styleZh: 'English - British', styleEn: 'English - British' },
]
