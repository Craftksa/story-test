import React, { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import Spinner from '@/components/Spinner';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { TrashIcon } from 'lucide-react';
import { useTranslations } from 'use-intl';

interface DeleteDialogProps {
  triggerButtonLabel?: string;
  confirmButtonLabel?: string;
  title?: string;
  className?: string;
  description?: string;
  confirmationText?: string;
  isDeleting?: boolean;
  disabled?: boolean;
  onConfirm: () => void;
  onCancel?: () => void;
}

const DeleteDialog: React.FC<DeleteDialogProps> = ({
                                                     triggerButtonLabel,
                                                     confirmButtonLabel = 'Continue',
                                                     className = '',
                                                     title = 'Are you absolutely sure?',
                                                     description = 'This action cannot be undone This will permanently delete this item',
                                                     confirmationText,
                                                     isDeleting = false,
                                                     disabled = false,
                                                     onConfirm,
                                                     onCancel,
                                                   }) => {
  const [inputValue, setInputValue] = useState('');
  const t = useTranslations();

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(event.target.value);
  };

  const requiresConfirmation = !!confirmationText;

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <button
          title={`${disabled ? 'Not allowed coming soon...' : 'Delete'}`}
          className={`${className} flex items-center gap-2 ${disabled ? 'cursor-not-allowed text-red-500/50' : ''}`}
          disabled={isDeleting || disabled}
        >
          {isDeleting ? <Spinner /> : <TrashIcon className="w-4 h-4" />}
          {triggerButtonLabel}
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t(title)}</AlertDialogTitle>
          {requiresConfirmation ? (
            <>
              <AlertDialogDescription>
                {t(description)}. {t('Write down')}{' '}
                <Badge className="bg-destructive hover:bg-destructive/80 text-background">
                  {confirmationText}
                </Badge>{' '}
                {t('to continue the process')}.
              </AlertDialogDescription>
              <Input
                type="text"
                value={inputValue}
                onChange={handleInputChange}
                placeholder={`${t('Type')} '${t(confirmationText)}' ${t('to confirm')}`}
              />
            </>
          ) : (
            <AlertDialogDescription>
              {t('Are you sure you want to delete this?')}
            </AlertDialogDescription>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>{t('Cancel')}</AlertDialogCancel>
          <AlertDialogAction
            className={`bg-destructive text-white hover:bg-destructive/80 ${
              requiresConfirmation && inputValue !== confirmationText ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            onClick={onConfirm}
            disabled={requiresConfirmation && inputValue !== confirmationText}
          >
            {t(confirmButtonLabel)}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default DeleteDialog;
