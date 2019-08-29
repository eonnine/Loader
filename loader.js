/**
 * [Dialog] 
 * 모듈화 툴입니다.
 * 이 모듈은 Promise 방식으로 처리됩니다.
 */

(function (factory) {
	window['Loader'] = factory;
}((function (Promise, PromiseAll) { 'use strict'
	
	var 	__Promise = new Promise();
	var __PromiseAll = new PromiseAll();
	var __HasProp = Object.prototype.hasOwnProperty;
	
	var Loader = {
		commonPath: '',
		/**
		 *  로드할 script 파일들의 약칭(전역 변수명)과 경로를 저장하는 객체입니다.
		 *  importJS함수의 인자는 약칭으로 넘기기 때문에 전역 변수를 사용할 때의 혼동을 피하기 위해 아래 형태를 권장합니다.
		 *  { 전역 변수명: 파일 경로, ... }
		 */
		importModule: Object.create(null),
		
		/**
		 * 이미 로드가 시작된 모듈의 약칭을 저장한 뒤 동일한 모듈의 추가 로딩을 막기 위해 사용합니다.
		 */
		loadedModuleName: Object.create(null),
		
		/**
		 *  define 함수의 인자로 전달받은 함수(라이브러리 등의 모듈을 반환하는 함수)를 여기에 저장합니다.
		 *  이 배열에 저장된 함수들은 script load 이벤트리스너에서 전역 객체에 등록됩니다.
		 */
		defineFn: [],
		
		/**
		 * 로드할 script 파일들의 경로를 저장하는 함수입니다.
		 * 약칭을 정할 수 있으며 importJS 함수로 파일을 로드할 때 약칭을 이용하여 로드합니다.
		 * @param modules => { 전역 변수명 : script파일의 경로, 'AUIGrid': '/js/AUIGrid/AUIGrid.js', ... }
		 */
		importConfig: function (modules) {
			Object.keys(modules).forEach(function (name) {
				// `modules[name]` is path of module
				this.importModule[name] = modules[name];
			}.bind(this));
		},
		
		/**
		 * importConfig에 정의한 script파일을 로드합니다.
		 * 첫번째 인자인 배열에는 importConfig에서 정의한 약칭이 들어갑니다.
		 * @param deps => ['AUIGrid', 'Axios', 'Util', ...]
		 * @param fn => deps의 scrpit파일들이 전부 로딩된 뒤 실행된 콜백 함수
		 */
		importJS: function (deps, fn, temp) {
			if( deps == null || !Array.isArray(deps) ){
				this.errorMsg('First', 'Array');
			}
			if( fn == null ){
				this.errorMsg('Second', 'Function');
			}
			
			var _this = this;

			__Promise.add(deps, fn);
			
			deps.forEach(function (name) {
				/**
				 * 이미 로드된 script파일이라면 추가로 로드하지 않음
				 */
				if( __HasProp.call(_this.loadedModuleName, name) ){
					return;
				}
				_this.loadedModuleName[name] = true;
				/**
				 * 배열 인자에 담긴 모듈명에 해당하는 script파일을 전부 lazy load하기 위해 PromiseAll 객쳉 추가합니다.
				 */
				__PromiseAll.add(function (resolve) {
					var paths = _this.importModule[name];
					/**
					 * 약칭에 해당하는 경로가 배열이고 요소가 2개 이상이라면 플러그인을 고려합니다. 
					 * 배열에 담긴 순서대로 의존성이 있다고 가정하여 Promise 처리합니다.
					 */
					if( Array.isArray(paths) && paths.length > 1 ){
						var promise = new Promise();
						promise.setCompleteFn(function () {
							resolve();
						});
						paths.forEach(function (pluginPath, i) {
							promise.then(function (pluginResolve) {
								/**
								 * 첫번째 경로의 파일은 메인 파일로 가정. 약칭으로 전역 객체에 등록됩니다.
								 * 두번째 경로의 파일부터는 플러그인으로 가정하고 로드만 됩니다.
								 */
								name = ( i == 0 ) ? name : '';
								_this.load(name, pluginResolve, pluginPath);
							});
						});
					/**
					 * 약칭에 해당하는 경로의 파일을 로드합니다.
					 */
					} else {
						_this.load(name, resolve, paths);
					}
				});
			});
			/**
			 * 의존성 체인을 따라 로드한 뒤 마지막 체인의 콜백 함수부터 
			 * 처음 체인의 콜백 함수 순으로 실행하기 위해서 스택에 넣습니다.
			 */
			__PromiseAll.setCompleteFn(function () {
				/**
				 * importJS가 실행될 때마다 push했던 콜백 함수들을 모두 pop하여(LIFO) 실행합니다.
				 */
				__Promise.start();
			});
			/**
			 * PromiseAll에 add된 모든 함수들이 resolve되어야 PromiseAll의 complete함수가 실행됩니다.
			 * add된 함수들 중 하나라도 resolve되지 않으면 종료되지 않습니다.
			 */
			__PromiseAll.start();
		},
		
		/**
		 * scriptNode를 생성하여 head영역에 appendChild합니다.
		 * 이런 방식을 lazy Load라고 하며 non-blocking으로 동작합니다.
		 */
		load: function (name, resolve, path) {
			var head = document.getElementsByTagName('head')[0];
			var node = this.createNode(name, resolve);
			/**
			 * importConfig함수로 설정한 각 script파일들의 경로를 가져옵니다.
			 * commonPath 속성과 경로를 합칩니다. (commonPath 기본값: '') 
			 */
			node.src = this.commonPath + path;
			head.appendChild(node);
		},
		
		createNode: function (name, resolve) {
			var node = document.createElement('script');
			node.type = 'text/javascript';
			node.charset = 'utf-8';
			node.async = true;
			/**
			 * 스크립트 노드를 삭제할 때 사용하기 위해 속성에 이름을 부여합니다.
			 */
			node.setAttribute('dialog-module-name', name);
			node.$loadEventListener = this.onLoadScript.bind(this, resolve);
			node.addEventListener('load', node.$loadEventListener, false);
			return node;
		},
		
		onLoadScript: function (resolve, e) {
			if(e.type === 'load'){
				e.target.removeEventListener('load', e.target.$loadEventListener);
				
				var name = e.target.getAttribute('dialog-module-name');
				/**
				 * define함수를 통해 정의된 모듈이 있다면 전역 객체에 등록
				 */
				var fn = this.defineFn.shift();
				if( fn && !__HasProp.call(window, name) ){
					window[name] = fn();
				}
				
				this.loadComplete(name);
				resolve();
			}
		},
		
		/**
		 * script 파일의 로드가 완료되면 해당 스크립트 노드를 삭제합니다.
		 */
		loadComplete: function (name) {
			var scriptNodes = document.getElementsByTagName('script');
			for(var i=0, node; node=scriptNodes[i]; i++){
				if (node.hasAttribute('dialog-module-name') && name === node.getAttribute('dialog-module-name')) {
					node.parentNode.removeChild(node);
					break;
				}
			}
		},
		
		errorMsg: function (ord, type) {
			new SyntaxError("[Dialog.importJS] "+ord+" argument is required. "+ord+" argument type must be " + type);
		},
		
		createDefine: function () {
			/**
			 * requireJs의 define 함수를 통해 라이브러리를 로드하는 라이브러리들을 고려하여 인자를 3개로 정의합니다.
			 * requireJs의 define 함수는 인자가 1개일 때는 첫번째 인자, 2개일 때는 두번째 인자, 3개일 때는 세번째 인자가 콜백 함수가 됩니다.
			 */
			return function define (_, __, fn) {
				fn = ( fn ) ? fn : ( __ ) ? __ : _;
				if( fn ) {
					this.defineFn.push(fn);
				}
			}.bind(this);
		}
	};
	
	window.define = Loader.createDefine();
	/**
	 * 보통 requireJs를 사용할 때 define 함수에 amd 속성이 있는지 체크하는 로직들이 많아서 추가합니다.
	 */
	define.amd = {};
	
	return Loader;
}(
	// define Promise		
	(function () {
	
	var Promise = function () {
		this.stack = [];
		this.ing = false;
		this.completeFn = null;
	}
	
	Promise.prototype.add = function (log, fn) {
		this.stack.push(fn);
	}
	
	Promise.prototype.run = function () {
		var a = this.stack.pop();
		console.log(a);
		a();
		if( this.stack.length > 0 ){
			this.run();
		} else {
			this.execCompleteFn();
		}
	}
	
	Promise.prototype.start = function () {
		this.run();
	}
	
	Promise.prototype.execCompleteFn = function () {
		if( this.completeFn ){
			this.completeFn();
			this.completeFn = null;
			this.ing = false;
		}
	}
	
	Promise.prototype.then = function (fn) {
		this.stack.push(fn);
		this.next();
	}
	
	Promise.prototype.next = function () {
		if( !this.ing ){
			this.ing = true;
			this.stack.shift()(this.makeResolve());
			
			if( this.stack.length == 0 ){
				this.execCompleteFn();
			}
		}
	}
	
	Promise.prototype.makeResolve = function () {
		return function resolve () {
			this.ing = false;
			if( this.stack.length > 0 ){
				this.next();
			}
		}.bind(this);
	}
	
	Promise.prototype.setCompleteFn = function (fn) {
		this.completeFn = fn;
	}
	
	return Promise;
	}()),
	// define Promise end
	
	// define PromiseAll
	(function () {
		var PromiseAll = function () {
			this.promise = [];
			this.loadedCnt = 0;
			this.completeFn = null;
		}
		
		PromiseAll.prototype.setCompleteFn = function (fn) {
			this.completeFn = fn;
		}
		
		PromiseAll.prototype.add = function (fn) {
			this.loadedCnt++;
			this.promise.push({
				fn: fn,
				isLoaded: false
			});
			return this;
		}
		
		PromiseAll.prototype.start = function () {
			// 프로미스 배열이 비어있다면 바로 Complete 함수 실행
			if(this.promise.length === 0){
				this.completeFn();
			}
			var _this = this;
			this.promise.forEach(function (obj) {
				if( !obj.isLoaded ){
					obj.isLoaded = true;
					obj.fn(_this.makeResolve(obj.key));
				}
			});
		}
		
		PromiseAll.prototype.makeResolve = function () {
			return function resolve () {
				this.loadedCnt--;
				if(this.loadedCnt == 0){
					if( this.completeFn ){
						this.completeFn();
					}
					this.clear();
				}
			}.bind(this);
		}
		
		PromiseAll.prototype.clear = function () {
			this.promise = [];
			this.loadedCnt = 0;
			this.completeFn = null;
		}
		
		return PromiseAll;
	}())
	// define PromiseAll end
))));