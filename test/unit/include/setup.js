(function () {
   'use strict';

   jest.mock('child_process', () => {
      return new MockChildProcess(true);
   });

   var mockChildProcess, mockChildProcesses, git;
   var sinon = require('sinon');

   const MockBuffer = {
      from (content, type) {
         return {
            type,
            toString () {
               return content;
            }
         }
      },

      concat () {
      }
   };

   function mockBufferFactory (sandbox) {
      const Buffer = sandbox.stub().throws(new Error('new Buffer() is fully deprecated'));
      Buffer.from = sandbox.spy();
      Buffer.concat = (things) => ({
         isBuffer: true,
         data: things,

         toString: sandbox.spy(() => [].join.call(things, '\n'))
      });

      return Buffer;
   }

   function MockChild () {
      mockChildProcesses.push(this);
      this.stdout = {
         on: sinon.spy()
      };
      this.stderr = {
         on: sinon.spy()
      };
      this.on = sinon.spy();
   }

   function MockChildProcess (asJestMock = false) {
      mockChildProcess = this;

      this.spawn = sinon.spy(function () {
         return new MockChild();
      });

      Object.defineProperty(this, 'asJestMock', {value: asJestMock});
   }

   function Instance (baseDir) {
      var Git = require('../../../src/git');

      var Buffer = MockBuffer;
      Buffer.concat = sinon.spy(function (things) {
         return {
            isBuffer: true,
            data: things,

            toString: sinon.spy(function () {
               return [].join.call(things, '\n');
            })
         };
      });

      return git = new Git(baseDir, mockChildProcess || new MockChildProcess, Buffer);
   }

   function instanceP (sandbox, baseDir) {
      const dependencies = require('../../../src/util/dependencies');

      sandbox.stub(dependencies, 'buffer').returns(mockBufferFactory(sandbox));

      return git = require('../../../promise')(baseDir);
   }

   function closeWith (data) {
      return childProcessEmits(
         'exit',
         typeof data !== 'number' ? data : null,
         typeof data === 'number' ? data : 0
      );

   }

   async function childProcessEmits (event, data, exitSignal) {
      await wait(10);

      if (typeof data === 'string') {
         data = Buffer.from(data);
      }

      var proc = mockChildProcesses[mockChildProcesses.length - 1];

      if (proc[event] && proc[event].on) {
         return proc[event].on.args[0][1](data);
      }

      if (Buffer.isBuffer(data)) {
         proc.stdout.on.args[0][1](data);
      }

      proc.on.args.forEach(function (handler) {
         if (handler[0] === event) {
            handler[1](exitSignal);
         }
      });

   }

   function errorWith (someMessage) {

      return new Promise(done => setTimeout(done, 10)).then(emit);

      function emit () {
         var handlers = mockChildProcesses[mockChildProcesses.length - 1].on.args;
         handlers.forEach(function (handler) {
            if (handler[0] === 'error') {
               handler[1]({
                  stack: someMessage
               });
            }
         });
      }

   }

   function theCommandRun () {
      return mockChildProcess.spawn.args[0][1];
   }

   function getCurrentMockChildProcess () {
      return mockChildProcess;
   }

   function theEnvironmentVariables () {
      return mockChildProcess.spawn.args[0][2].env;
   }

   function wait (timeout) {
      return new Promise(ok => setTimeout(ok, timeout || 10));
   }

   module.exports = {
      childProcessEmits,
      closeWith,
      closeWithP: closeWith,
      errorWith,
      Instance,
      instanceP,
      MockBuffer,
      MockChildProcess,
      theCommandRun,
      theCommandsRun () {
         return mockChildProcess.spawn.args.map(([binary, commands]) => commands);
      },
      theEnvironmentVariables,
      getCurrentMockChildProcess,

      restore (sandbox) {
         git = null;

         if (mockChildProcess && !mockChildProcess.asJestMock) {
            mockChildProcess = null;
         }
         else if (mockChildProcess) {
            mockChildProcess.spawn.resetHistory();
         }

         mockChildProcesses = [];

         if (sandbox) {
            sandbox.restore();
         }
      },

      wait,
   };

}());
