import { ChangeDetectionStrategy, Component, ElementRef, effect, inject, viewChild } from '@angular/core';
import {
  AlertCircle,
  CalendarDays,
  CarFront,
  Database,
  Download,
  Eye,
  FileText,
  Search,
} from 'lucide';
import type { VehicleDocument } from '../contracts/car-documents';
import { useMessages } from '../i18n/localization';
import { carDocumentMessages } from '../i18n/car-documents';
import { Icon } from '../ui/icon';
import { SkipLink } from '../ui/skip-link';
import { VehicleDocumentsClient } from '../api/cars/vehicle-documents';
import { VehicleDocumentsState } from './monitor-state';

@Component({
  selector: 'car-documents-page',
  imports: [Icon, SkipLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './documents-page.html',
  styleUrl: './documents-page.css',
})
export class VehicleDocumentsPage {
  private readonly loadMoreTrigger = viewChild<ElementRef<HTMLElement>>('loadMoreTrigger');
  protected readonly state = inject(VehicleDocumentsState);
  protected readonly client = inject(VehicleDocumentsClient);
  protected readonly m = useMessages(carDocumentMessages);
  protected readonly AlertCircle = AlertCircle;
  protected readonly CalendarDays = CalendarDays;
  protected readonly CarFront = CarFront;
  protected readonly Database = Database;
  protected readonly Download = Download;
  protected readonly Eye = Eye;
  protected readonly FileText = FileText;
  protected readonly Search = Search;

  constructor() {
    effect(onCleanup => {
      const trigger = this.loadMoreTrigger();
      if (!trigger || !this.state.nextCursor() || this.state.loading() || this.state.moreError()) return;
      if (typeof IntersectionObserver === 'undefined') return;
      const observer = new IntersectionObserver(entries => {
        if (!this.state.moreError() && entries.some(entry => entry.isIntersecting)) void this.state.loadMore();
      }, { rootMargin: '240px' });
      observer.observe(trigger.nativeElement);
      onCleanup(() => observer.disconnect());
    });
  }

  protected updateVin(event: Event) {
    this.state.setVin((event.target as HTMLInputElement).value);
  }

  protected identifierKeydown(event: KeyboardEvent) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.state.moveIdentifierSelection(1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.state.moveIdentifierSelection(-1);
    } else if (event.key === 'Enter' && this.state.activeIdentifier() >= 0) {
      event.preventDefault();
      this.state.selectActiveIdentifier();
    } else if (event.key === 'Escape' && this.state.identifiersOpen()) {
      event.preventDefault();
      this.state.closeIdentifiers();
    }
  }

  protected selectIdentifier(vin: string) {
    this.state.selectIdentifier(vin);
  }

  protected submitSearch(event: SubmitEvent) {
    event.preventDefault();
    void this.state.search();
  }

  protected formatDate(value: string | null) {
    return value ? new Date(value).toLocaleDateString() : this.m().notProvided;
  }

  protected contentUrl(document: VehicleDocument, download = false) {
    return this.client.contentUrl(document, download);
  }
}
