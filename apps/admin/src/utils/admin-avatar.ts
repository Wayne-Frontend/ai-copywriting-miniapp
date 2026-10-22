import avatar1 from '@/assets/images/avatar/avatar1.webp'
import avatar2 from '@/assets/images/avatar/avatar2.webp'
import avatar3 from '@/assets/images/avatar/avatar3.webp'
import avatar4 from '@/assets/images/avatar/avatar4.webp'
import avatar5 from '@/assets/images/avatar/avatar5.webp'
import avatar6 from '@/assets/images/avatar/avatar6.webp'
import avatar7 from '@/assets/images/avatar/avatar7.webp'
import avatar8 from '@/assets/images/avatar/avatar8.webp'
import avatar9 from '@/assets/images/avatar/avatar9.webp'
import avatar10 from '@/assets/images/avatar/avatar10.webp'
import fallbackAvatar from '@/assets/images/user/avatar.webp'

export const ADMIN_AVATARS = {
  avatar1,
  avatar2,
  avatar3,
  avatar4,
  avatar5,
  avatar6,
  avatar7,
  avatar8,
  avatar9,
  avatar10
}

export type AdminAvatarKey = keyof typeof ADMIN_AVATARS
export const avatarKeys = Object.keys(ADMIN_AVATARS) as AdminAvatarKey[]

export function adminAvatar(key: string | null | undefined) {
  return key && key in ADMIN_AVATARS ? ADMIN_AVATARS[key as AdminAvatarKey] : fallbackAvatar
}
