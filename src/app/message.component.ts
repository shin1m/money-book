import {Component, Input, TemplateRef, ViewChild, ViewContainerRef} from '@angular/core';

@Component({
  selector: 'mb-message',
  template: '<ng-template #content><ng-content></ng-content></ng-template>'
})
export class MessageComponent {
  @Input() name: string;
  value: string;
  @ViewChild('content') set content(value: TemplateRef<any>) {
    const view = this.container.createEmbeddedView(value);
    this.value = view.rootNodes[0].nodeValue;
    view.destroy();
  }
  constructor(private container: ViewContainerRef) {}
}
