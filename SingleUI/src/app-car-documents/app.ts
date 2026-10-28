import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { productDocument } from '../preferences/product-document';
import { useMessages } from '../i18n/localization';
import { carDocumentMessages } from '../i18n/car-documents';
import { VehicleDocumentsPage } from './monitor-page';
import { VehicleDocumentsState } from './monitor-state';

@Component({
  selector: 'app-root',
  imports: [VehicleDocumentsPage],
  providers: [VehicleDocumentsState],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<car-documents-page />',
})
export class App {
  private readonly messages = useMessages(carDocumentMessages);
  constructor() {
    inject(VehicleDocumentsState);
    productDocument('car-documents', () => this.messages().title);
  }
}
