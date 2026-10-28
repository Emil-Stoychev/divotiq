import Button from './Button'
import Modal from './Modal'

export default function ConfirmDialog({ open, title, text, confirmLabel = 'Потвърди', tone = 'danger', onConfirm, onCancel, loading }) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onCancel}>Отказ</Button>
          <Button variant={tone} onClick={onConfirm} loading={loading}>{confirmLabel}</Button>
        </>
      }
    >
      <p className="text-muted">{text}</p>
    </Modal>
  )
}
