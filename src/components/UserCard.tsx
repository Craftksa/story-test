// components/UserCard.tsx
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { getInitials } from "@/lib/utils"
import StatusBadge from "./StatusBadgeSystem"

interface UserCardProps {
	user: {
		id: string
		name: string
		email: string
		role: string
		image?: string | null
	}
}

export function UserCard({ user }: UserCardProps) {
	return (
		<div className="p-3 rounded-lg bg-muted">
			<div className="flex items-center space-x-3">
				<Avatar className="h-10 w-10">
					<AvatarImage src={user.image || undefined} />
					<AvatarFallback className="bg-primary/10 font-semibold text-primary/90">
						{getInitials(user.name)}
					</AvatarFallback>
				</Avatar>
				<div className="flex-1">
					<div className="flex items-center justify-between">
						<p className="font-medium">{user.name}</p>
						<StatusBadge status={user.role} />
					</div>
					<p className="text-sm text-muted-foreground">{user.email}</p>
				</div>
			</div>
		</div>
	)
}
