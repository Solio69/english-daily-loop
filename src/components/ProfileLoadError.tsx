import { Button } from './Button'
import { InlineStatusCard } from './InlineStatusCard'

type ProfileLoadErrorProps = {
  message: string
  onRetry: () => void
}

const ERROR_TITLE = 'Не удалось загрузить профиль'
const RETRY_LABEL = 'Повторить вход'

export const ProfileLoadError = ({
  message,
  onRetry,
}: ProfileLoadErrorProps) => (
  <main className="mx-auto flex min-h-[100dvh] w-full max-w-[430px] flex-col justify-center gap-4 px-3.5 min-[390px]:px-4 min-[480px]:max-w-[390px] min-[480px]:px-3">
    <InlineStatusCard
      variant="error"
      title={ERROR_TITLE}
      description={message}
    />
    <Button onClick={onRetry} className="w-full">
      {RETRY_LABEL}
    </Button>
  </main>
)
