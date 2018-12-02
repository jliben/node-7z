import Debug from 'debug'
import { STAGE_BODY } from './references.js'
const debug = Debug('node-7z')

export const onErrorFactory = ({ Err }) => (stream, err) => {
  Err.assign(stream, err)
  debug('error: from child process: %O', err)
  return stream
}

export const onStderrFactory = ({ Err }) => (stream, buffer) => {
  const err = Err.fromBuffer(buffer)
  Err.assign(stream, err)
  debug('error: from stderr: %O', err)
  return stream
}

export const onStdoutFactory = ({ Lines, Maybe }) => (stream, chunk) => {
  const lines = Lines.fromBuffer(stream, chunk)

  // Maybe functions check if a condition is true and run the corresponding
  // actions. They can mutate the stream, emit events, etc. The structure bellow
  // only does flow control.
  for (let line of lines) {
    debug('stdout: %s', line)

    // Infos about the opertation are given by 7z on the stdout. They can be:
    // - colon-seprated: `Creating archive: DirNew/BaseExt.7z`
    // - equal-separated: `Method = LZMA2:12`
    // - two on one line: `Prop 1: Data 1,  # Prop 2: Data 2`
    // - in the HEADERS or in the FOOTERS
    // stream function match if the current line contains some infos. A **Map**
    // is used to store infos in the stream.
    const infos = Maybe.info(stream, line)
    if (infos) {
      continue // at next line
    }

    const endOfHeaders = Maybe.endOfHeaders(stream, line)
    if (endOfHeaders && stream._dataType !== 'symbol') {
      continue // at next line
    }

    const stageBody = (stream._stage === STAGE_BODY)
    if (!stageBody) {
      continue // at next line
    }

    const endOfBody = Maybe.endOfBody(stream, line)
    if (endOfBody) {
      continue // at next line
    }

    // Progress as a percentage is only displayed to stdout when the `-bsp1`
    // switch is specified. Progress can has several forms:
    // - only percent: `  0%`
    // - with file count: ` 23% 4`
    // - with file name: ` 23% 4 file.txt`
    const bodyProgress = Maybe.progress(stream, line)
    if (bodyProgress) {
      continue // at next line
    }

    Maybe.bodyData(stream, line)
  }
  return stream
}

export const onEndFactory = () => (stream) => {
  if (stream.err) {
    stream.emit('error', stream.err)
  } else {
    stream.emit('end')
  }
  return stream
}