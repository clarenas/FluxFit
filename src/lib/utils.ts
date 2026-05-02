import type { OccupancyStatus } from './types';

export function formatCLP(amount: number): string {
  return '$' + amount.toLocaleString('es-CL');
}

export function getOccupancyColor(status: OccupancyStatus | string): string {
  switch (status) {
    case 'tranquilo': return '#16A34A';
    case 'moderado': return '#EAB308';
    case 'lleno': return '#CC0000';
    default: return '#E5E5E5';
  }
}

export function getOccupancyLabel(status: OccupancyStatus | string): string {
  switch (status) {
    case 'tranquilo': return 'Tranquilo';
    case 'moderado': return 'Moderado';
    case 'lleno': return 'Lleno';
    default: return 'Sin datos';
  }
}

export function getOccupancyMessage(status: OccupancyStatus | string): string {
  switch (status) {
    case 'tranquilo': return 'Buen momento para ir';
    case 'moderado': return 'Hay espacio disponible';
    case 'lleno': return 'Considera venir más tarde';
    default: return 'Sin información';
  }
}

export function getCommerceCategoryEmoji(category: string): string {
  switch (category) {
    case 'nutricion': return '🥗';
    case 'suplementos': return '💊';
    case 'indumentaria': return '👕';
    case 'fisioterapia': return '🦵';
    default: return '🏪';
  }
}

export function getServiceCategoryLabel(category: string): string {
  switch (category) {
    case 'nutricion': return 'Nutrición';
    case 'kinesiologia': return 'Kinesiología';
    case 'entrenamiento': return 'Entrenamiento';
    default: return 'Otro';
  }
}

export function getCommerceCategoryLabel(category: string): string {
  switch (category) {
    case 'nutricion': return 'Nutrición';
    case 'suplementos': return 'Suplementos';
    case 'indumentaria': return 'Indumentaria';
    case 'fisioterapia': return 'Fisioterapia';
    default: return 'Otro';
  }
}

export function getDayLabel(dayOfWeek: number): string {
  const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  return days[dayOfWeek] ?? '';
}

export function getFullDayLabel(dayOfWeek: number): string {
  const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  return days[dayOfWeek] ?? '';
}

export function timeAgo(dateStr: string | null): string {
  if (!dateStr) return 'Sin datos';
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'hace un momento';
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return `hace ${hours}h`;
}

export function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}
