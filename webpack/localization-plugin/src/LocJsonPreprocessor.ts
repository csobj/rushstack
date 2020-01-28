// Copyright (c) Microsoft Corporation. All rights reserved. Licensed under the MIT license.
// See LICENSE in the project root for license information.

import {
  FileSystem,
  JsonFile,
  JsonSchema
} from '@microsoft/node-core-library';
import * as glob from 'glob';
import * as path from 'path';
import { EOL } from 'os';

import { ILocJsonFile } from './interfaces';

/**
 * @public
 */
export interface ILocJsonPreprocessorOptions {
  srcFolder: string;
  generatedTsFolder: string;
  filesToIgnore?: string[];
}

/**
 * This is a simple tool that generates .d.ts files for .loc.json files.
 *
 * @public
 */
export class LocJsonPreprocessor {
  public static preprocessLocJsonFiles(options: ILocJsonPreprocessorOptions): void {
    const {
      srcFolder,
      generatedTsFolder
    }: ILocJsonPreprocessorOptions = options;

    const filesToIgnore: Set<string> = new Set<string>((options.filesToIgnore || []).map((fileToIgnore) => {
      if (path.isAbsolute(fileToIgnore)) {
        return fileToIgnore;
      } else {
        return path.resolve(srcFolder, fileToIgnore);
      }
    }));

    FileSystem.ensureEmptyFolder(generatedTsFolder);
    const locJsonFiles: string[] = glob.sync(
      path.join('**', '*.loc.json'),
      {
        root: srcFolder,
        absolute: true
      }
    );

    const locJsonSchema: JsonSchema = JsonSchema.fromFile(path.resolve(__dirname, 'schemas', 'locJson.schema.json'));

    for (let locJsonFilePath of locJsonFiles) {
      locJsonFilePath = path.resolve(locJsonFilePath);

      if (filesToIgnore.has(locJsonFilePath)) {
        continue;
      }

      const outputLines: string[] = [
        '// This file was generated by a tool. Modifying it will produce unexpected behavior',
        ''
      ];

      const locJsonFile: ILocJsonFile = JsonFile.loadAndValidate(locJsonFilePath, locJsonSchema);
      for (const stringName in locJsonFile) { // eslint-disable-line guard-for-in
        const { comment } = locJsonFile[stringName];

        if (comment.trim()) {
          outputLines.push(...[
            '/**',
            ` * ${comment.replace(/\*\//g, '*\\/')}`,
            ' */'
          ]);
        }

        outputLines.push(...[
          `export declare const ${stringName}: string;`,
          ''
        ]);
      }

      const generatedTsFilePath: string = (
        `${path.resolve(generatedTsFolder, path.relative(srcFolder, locJsonFilePath))}.d.ts`
      );
      FileSystem.ensureFolder(path.dirname(generatedTsFilePath));
      FileSystem.writeFile(generatedTsFilePath, outputLines.join(EOL));
    }
  }
}
