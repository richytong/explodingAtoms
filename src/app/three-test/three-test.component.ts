import { Component, OnInit, ViewChild, ElementRef, AfterViewInit, OnDestroy } from '@angular/core';
import * as THREE from 'three';
import { Subscription, fromEvent, Observable, BehaviorSubject, combineLatest } from 'rxjs';
import { msElapsed } from '../tools';
import { map, filter, tap, take } from 'rxjs/operators';
import { Mesh, MeshLambertMaterial, Object3D } from 'three';

// Following this example: https://stackoverflow.com/questions/40273300/angular-cli-threejs

interface Vector2d {
  x: number;
  y: number;
}

const SIZE = 10;
const DIVISIONS = 10;

@Component({
  selector: 'app-three-test',
  templateUrl: './three-test.component.html',
  styleUrls: ['./three-test.component.css']
})
export class ThreeTestComponent implements OnInit, AfterViewInit, OnDestroy {

  @ViewChild('rendererContainer') rendererContainer: ElementRef;

  renderer = new THREE.WebGLRenderer({ antialias: true });
  rayCaster = new THREE.Raycaster();
  scene = null;
  camera = null;
  fieldGeometry: Object3D;
  cellsGeometry: Object3D;

  nFrame = 0;

  mouseMove$: Observable<MouseEvent>;
  mouseDown$: Observable<MouseEvent>;
  mouseUp$: Observable<MouseEvent>;
  windowSize$ = new BehaviorSubject<Vector2d>({x: 0, y: 0});

  mouseMoveScene$: Observable<Vector2d>;

  cons = new Subscription();

  constructor() {
    this.scene = new THREE.Scene();
    this.onResize();

    const geometry = new THREE.BoxGeometry(200, 200, 200);
    const material = new THREE.MeshBasicMaterial({color: 0xff0000, wireframe: true});
    // this.mesh = new THREE.Mesh(geometry, material);

    // this.scene.add(this.mesh);

    this.buildScene();
  }

  ngOnInit() {
  }

  buildScene() {
    this.scene.add( new THREE.AmbientLight( 0x404040, 0.6 )); // soft white light
    const light = new THREE.DirectionalLight( 0xffffff, 0.35 );
    light.position.set( 1, 1, 1 ).normalize();
    this.scene.add( light );

    const fieldGroup = new THREE.Group();
    const grid = new THREE.GridHelper( SIZE, DIVISIONS, 0xffffff, 0xffff00 );
    grid.rotation.x = Math.PI / 2;

    fieldGroup.add(grid);

    const celGroup = new THREE.Group();
    const planeSize = SIZE / DIVISIONS;
    const bottom = -SIZE / 2;
    const left = -SIZE / 2;
    for (let y = 0; y < DIVISIONS; ++y) {
      for (let x = 0; x < DIVISIONS; ++x) {
        const material = new THREE.MeshLambertMaterial( {color: 0x555500} );
        const geometry = new THREE.PlaneGeometry(planeSize, planeSize);
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.setX(left + (x + .5) * planeSize);
        mesh.position.setY(bottom + (y + .5) * planeSize);
        mesh.name = JSON.stringify({plane: {x, y}});
        celGroup.add(mesh);
      }
    }

    console.log(celGroup);
    fieldGroup.add(celGroup);

    this.cellsGeometry = celGroup;
    this.fieldGeometry = fieldGroup;

    this.scene.add(fieldGroup);

    {
      const geometry = new THREE.SphereGeometry( 2, 32, 32 );
      const material = new THREE.MeshLambertMaterial( {color: 0xff0000} );
      const sphere = new THREE.Mesh( geometry, material );
      // this.scene.add( sphere );
    }
  }

  onResize() {
    const width = window.innerWidth;
    const height = window.innerHeight - 4;
    console.log(`Resizing... (${width}x${height})`);
    this.camera = new THREE.PerspectiveCamera(75, width / height, 1, 10000);
    this.camera.position.z = 10;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);

    this.windowSize$.next({x: width, y: height});
  }

  ngOnDestroy() {
    this.cons.unsubscribe();
  }

  ngAfterViewInit() {
    this.mouseMove$ = fromEvent(this.rendererContainer.nativeElement, 'mousemove');
    this.mouseDown$ = fromEvent(this.rendererContainer.nativeElement, 'mousedown');
    this.mouseUp$ = fromEvent(this.rendererContainer.nativeElement, 'mouseup');

    this.mouseMoveScene$ = combineLatest(
      this.mouseMove$, this.windowSize$.pipe(filter(v => v.x > 0), tap(console.log)),
      (event: MouseEvent, wndSize: Vector2d) => ({
      x:   ( event.clientX / wndSize.x ) * 2 - 1,
      y: - ( event.clientY / wndSize.y ) * 2 + 1
    }));

    this.rendererContainer.nativeElement.appendChild(this.renderer.domElement);
    this.cons.add(msElapsed().subscribe(time => this.animate(time)));
    msElapsed().pipe(take(1)).subscribe(_ => {
      this.cons.add(this.mouseMoveScene$.pipe(
        map(v =>  {
          this.rayCaster.setFromCamera(v, this.camera);
          return this.rayCaster.intersectObjects(this.cellsGeometry.children);
          // return v;
        }))
        .subscribe(v => {
          console.log('*** Mouse move', v);
          for (const i of v) {
            if (i.object instanceof Mesh) {
              if (i.object.material instanceof MeshLambertMaterial) {
                console.log('Object content: ', i.object.name);
                i.object.material.color.r = Math.random() * 1;
                i.object.material.color.g = Math.random() * 1;
                i.object.material.color.b = Math.random() * 1;
              }
            }
          }
        }));
      });
  }

  animate(time: number) {
    ++this.nFrame;
    // this.fieldGrid.rotation.x = time / 1000;
    this.fieldGeometry.rotation.y = Math.sin(time / 50000) / 3;
    this.fieldGeometry.rotation.x = Math.sin(time / 70000) / 4;
    this.renderer.render(this.scene, this.camera);
  }
}
