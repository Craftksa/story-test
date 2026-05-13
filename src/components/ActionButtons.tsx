'use client';

import {EditIcon, EyeIcon} from "lucide-react";
import {useSession} from "next-auth/react";
import {useState} from "react";
import {hasRole} from "@/lib/utils";
import {Button} from "@/components/ui/button";
import DeleteDialog from "@/components/DeleteDialog";
import {useRouter} from "next/navigation";

interface ActionButtonsProps {
	entity?: 'project' | 'task' | string;
	data: any;
	view?: boolean;
	onDelete: (data: any) => void;
	confirmationText: string;
	viewPath?: string;
	editPath?: string;
	extraActions?: React.ReactNode;
}

export const ActionButtons = ({
	                              entity, view = true,
	                              data,
	                              onDelete,
	                              confirmationText,
	                              viewPath,
	                              editPath,
	                              extraActions,
                              }: ActionButtonsProps) => {
	const {data: session} = useSession();
	const user = session?.user;
	const router = useRouter();
	const [deleting, setDeleting] = useState(false);

	const handleView = () => router.push(viewPath || `/${entity}s/${data.id}`);
	const handleEdit = () => router.push(editPath || `/${entity}s/edit/${data.id}`);

	return (
		<div className="flex gap-1 items-center">
			{view && <Button variant="rounded" title={'View Details'} size="icon" onClick={handleView}>
          <EyeIcon className="h-4 w-4"/>
      </Button>}
			<>
				{user && hasRole(user, ['admin', 'moderator', 'employee']) && (
					<Button variant="rounded" title={'Edit Details'} size="icon" onClick={handleEdit}>
						<EditIcon className="h-4 w-4"/>
					</Button>
				)}
				{hasRole(user, ['admin', 'moderator']) && (
					<DeleteDialog
						confirmationText={confirmationText}
						isDeleting={deleting}
						className="px-2 text-destructive w-8 h-8 rounded-full hover:bg-muted my-1"
						onCancel={() => setDeleting(false)}
						onConfirm={() => onDelete(data)}
					/>
				)}
			</>
			{extraActions && <>{extraActions}</>}
		</div>
	);
};
