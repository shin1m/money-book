System.config({
  transpiler: 'ts',
  typescriptOptions: {
    target: 'es5',
    module: 'commonjs',
    moduleResolution: 'node',
    sourceMap: true,
    emitDecoratorMetadata: true,
    experimentalDecorators: true,
    lib: ['es2015', 'dom'],
    noImplicitAny: true,
    suppressImplicitAnyIndexErrors: true
  },
  meta: {
    typescript: {
      exports: 'ts'
    }
  },
  paths: {
    'npm:': 'https://unpkg.com/'
  },
  map: {
    'app': 'src',

    '@angular/core': 'npm:@angular/core/bundles/core.umd.js',
    '@angular/common': 'npm:@angular/common/bundles/common.umd.js',
    '@angular/compiler': 'npm:@angular/compiler/bundles/compiler.umd.js',
    '@angular/platform-browser': 'npm:@angular/platform-browser/bundles/platform-browser.umd.js',
    '@angular/platform-browser-dynamic': 'npm:@angular/platform-browser-dynamic/bundles/platform-browser-dynamic.umd.js',
    '@angular/http': 'npm:@angular/http/bundles/http.umd.js',
    '@angular/router': 'npm:@angular/router/bundles/router.umd.js',
    '@angular/forms': 'npm:@angular/forms/bundles/forms.umd.js',

    '@angular/core/testing': 'npm:@angular/core/bundles/core-testing.umd.js',
    '@angular/common/testing': 'npm:@angular/common/bundles/common-testing.umd.js',
    '@angular/compiler/testing': 'npm:@angular/compiler/bundles/compiler-testing.umd.js',
    '@angular/platform-browser/testing': 'npm:@angular/platform-browser/bundles/platform-browser-testing.umd.js',
    '@angular/platform-browser-dynamic/testing': 'npm:@angular/platform-browser-dynamic/bundles/platform-browser-dynamic-testing.umd.js',
    '@angular/http/testing': 'npm:@angular/http/bundles/http-testing.umd.js',
    '@angular/router/testing': 'npm:@angular/router/bundles/router-testing.umd.js',

    'rxjs': 'npm:rxjs',
    'ts': 'npm:plugin-typescript@5.2.7/lib/plugin.js',
    'typescript': 'npm:typescript@2.1.6/lib/typescript.js',

    '@angular/material': 'npm:@angular/material/bundles/material.umd.js',
    'angular2-highcharts': 'npm:angular2-highcharts/dist',
    'angular2-highcharts/dist/HighchartsService': 'npm:angular2-highcharts/dist/HighchartsService',
    'highcharts': 'npm:highcharts',

    text: 'systemjs-text-plugin.js'
  },
  packages: {
    app: {
      main: './main.ts',
      defaultExtension: 'ts'
    },
    rxjs: {
      defaultExtension: 'js'
    },
    highcharts: {
      main: './highcharts.js',
      defaultExtension: 'js'
    },
    'angular2-highcharts': {
      main: './index.js',
      defaultExtension: 'js'
    }
  }
});
