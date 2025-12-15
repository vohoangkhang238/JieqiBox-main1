<template>
  <div class="sidebar">
    <div class="engine-management">
      <v-select
        v-model="selectedEngineId"
        :items="managedEngines"
        item-title="name"
        item-value="id"
        :label="$t('analysis.selectEngine')"
        density="compact"
        hide-details
        class="engine-select"
        variant="outlined"
      ></v-select>
      <v-btn
        @click="loadSelectedEngine"
        :loading="
          isMatchMode ? jaiEngine?.isEngineLoading?.value : isEngineLoading
        "
        :disabled="
          (isMatchMode ? jaiEngine?.isEngineLoading?.value : isEngineLoading) ||
          !selectedEngineId ||
          (isMatchMode ? jaiEngine?.isEngineLoaded?.value : isEngineLoaded)
        "
        :color="
          (isMatchMode ? jaiEngine?.isEngineLoaded?.value : isEngineLoaded)
            ? 'success'
            : 'teal'
        "
        size="x-small"
        class="action-btn"
        icon="mdi-play-circle"
        :title="$t('analysis.loadEngine')"
      >
      </v-btn>
      <v-btn
        @click="handleUnloadEngine"
        :disabled="
          !(isMatchMode ? jaiEngine?.isEngineLoaded?.value : isEngineLoaded)
        "
        color="error"
        size="x-small"
        class="action-btn"
        icon="mdi-stop-circle"
        :title="$t('analysis.unloadEngine')"
      >
      </v-btn>
      <v-btn
        @click="showEngineManager = true"
        color="blue-grey"
        size="x-small"
        class="action-btn"
        icon="mdi-cogs"
        :title="$t('analysis.manageEngines')"
      >
      </v-btn>
    </div>

    <div v-if="isMatchMode" class="match-mode-buttons">
      <div class="button-group">
        <v-btn
          @click="toggleMatchMode"
          color="success"
          class="grouped-btn"
          size="small"
        >
          {{ $t('analysis.exitMatchMode') }}
        </v-btn>

        <v-btn
          @click="handleMatchButtonClick"
          :disabled="!jaiEngine?.isEngineLoaded?.value"
          :color="jaiEngine?.isMatchRunning?.value ? 'warning' : 'green'"
          class="grouped-btn"
          size="small"
        >
          {{
            jaiEngine?.isMatchRunning?.value
              ? $t('analysis.stopMatch')
              : $t('analysis.startMatch')
          }}
        </v-btn>
      </div>

      <div class="button-group">
        <v-btn
          @click="showJaiOptionsDialog = true"
          :disabled="!jaiEngine?.isEngineLoaded?.value"
          color="purple"
          size="small"
          class="grouped-btn"
          prepend-icon="mdi-cogs"
        >
          {{ $t('analysis.jaiSettings') }}
        </v-btn>

        <v-btn
          @click="showEloCalculatorDialog = true"
          color="orange"
          size="small"
          class="grouped-btn"
          prepend-icon="mdi-calculator"
        >
          {{ $t('analysis.eloCalculator') }}
        </v-btn>
      </div>
    </div>

    <div v-else-if="isHumanVsAiMode" class="button-group">
      <v-btn
        @click="exitHumanVsAiMode"
        color="teal"
        class="grouped-btn"
        size="small"
      >
        {{ $t('analysis.exitHumanVsAiMode') }}
      </v-btn>
    </div>

    <div v-else class="button-group">
      <v-btn
        @click="toggleMatchMode"
        color="amber"
        class="grouped-btn"
        size="small"
      >
        {{ $t('analysis.enterMatchMode') }}
      </v-btn>
      <v-btn
        @click="showHumanVsAiDialog = true"
        color="teal"
        class="grouped-btn"
        size="small"
      >
        {{ $t('analysis.enterHumanVsAiMode') }}
      </v-btn>
    </div>

    <div class="button-group">
      <v-btn
        @click="handleUndoMove"
        :disabled="currentMoveIndex <= 0 || isMatchRunning"
        color="error"
        class="grouped-btn"
        size="small"
      >
        {{ $t('analysis.undoMove') }}
      </v-btn>
      <v-btn
        @click="toggleBoardFlip()"
        color="cyan"
        class="grouped-btn"
        size="small"
      >
        {{
          isBoardFlipped
            ? $t('analysis.flipBoardBack')
            : $t('analysis.flipBoard')
        }}
      </v-btn>
    </div>

    <div v-if="!isMatchMode && !isHumanVsAiMode" class="autoplay-settings">
      <v-btn
        @click="toggleRedAi"
        :color="isRedAi ? 'error' : 'blue-grey-darken-1'"
        class="half-btn"
        size="small"
        :disabled="isManualAnalysis || !isEngineLoaded"
      >
        {{ isRedAi ? $t('analysis.redAiOn') : $t('analysis.redAiOff') }}
      </v-btn>
      <v-btn
        @click="toggleBlackAi"
        :color="isBlackAi ? 'error' : 'blue-grey-darken-1'"
        class="half-btn"
        size="small"
        :disabled="isManualAnalysis || !isEngineLoaded"
      >
        {{ isBlackAi ? $t('analysis.blackAiOn') : $t('analysis.blackAiOff') }}
      </v-btn>
    </div>

    <div class="button-group">
      <v-btn
        @click="restoreDefaultLayout"
        color="grey"
        class="grouped-btn"
        size="small"
        prepend-icon="mdi-backup-restore"
      >
        {{ $t('analysis.restorePanels') }}
      </v-btn>
    </div>

    <div v-if="!isMatchMode && !isHumanVsAiMode" class="switch-row">
      <v-switch
        v-model="flipMode"
        :label="$t('analysis.freeFlipMode')"
        color="amber"
        true-value="free"
        false-value="random"
        hide-details
        class="compact-switch"
        density="compact"
      />

      <v-switch
        v-model="enablePonder"
        :label="$t('analysis.ponderMode')"
        color="lime"
        hide-details
        class="compact-switch"
        density="compact"
      />
    </div>

    <DraggablePanel v-if="shouldShowLuckIndex" panel-id="luck-index">
      <template #header>
        <h3 class="section-title">{{ $t('analysis.luckIndex') }}</h3>
      </template>
      <div class="luck-index-panel">
        <div class="luck-description">
          {{ $t('analysis.luckIndexBasedOnFlipSequence') }}
        </div>
        <div class="luck-row">
          <span class="label">{{ $t('analysis.currentValue') }}</span>
          <span class="luck-value" :class="luckClass">{{ luckIndex }}</span>
        </div>
        <div class="luck-axis">
          <div class="axis-track"></div>
          <div
            class="axis-tick"
            v-for="tick in axisTicks"
            :key="tick.pos"
            :style="{ left: tick.pos + '%' }"
          >
            <span class="tick-label">{{ tick.label }}</span>
          </div>
          <div class="axis-zero" :style="{ left: '50%' }"></div>
          <div class="axis-marker" :class="luckClass" :style="markerStyle">
            <span class="marker-value">{{ luckIndex }}</span>
          </div>
        </div>
        <div class="luck-legend">
          <span>{{ $t('analysis.blackFavor') }}</span>
          <span>{{ $t('analysis.redFavor') }}</span>
        </div>
      </div>
    </DraggablePanel>

    <CaptureHistoryPanel v-if="isHumanVsAiMode" />

    <DraggablePanel v-if="!isHumanVsAiMode" panel-id="dark-piece-pool">
      <template #header>
        <h3 class="section-title">
          {{ $t('analysis.darkPiecePool') }}
          <v-chip
            size="x-small"
            :color="validationStatusKey === 'normal' ? 'green' : 'red'"
            variant="flat"
          >
            {{ validationStatusMessage }}
          </v-chip>
        </h3>
      </template>
      <div class="pool-manager">
        <div
          v-for="item in unrevealedPiecesForDisplay"
          :key="item.char"
          class="pool-item"
        >
          <img
            :src="getPieceImageUrl(item.name)"
            :alt="item.name"
            class="pool-piece-img"
          />
          <div class="pool-controls">
            <div class="control-group">
              <v-btn
                density="compact"
                icon="mdi-plus"
                size="x-small"
                @click="adjustUnrevealedCount(item.char, 1)"
                :disabled="item.count >= item.max"
              />
              <v-btn
                density="compact"
                icon="mdi-minus"
                size="x-small"
                @click="adjustUnrevealedCount(item.char, -1)"
                :disabled="item.count <= 0"
              />
            </div>
            <span class="pool-count"
              >{{ item.count }}({{ item.capturedCount }})</span
            >
            <div class="control-group">
              <v-btn
                density="compact"
                icon="mdi-plus"
                size="x-small"
                @click="adjustCapturedUnrevealedCount(item.char, 1)"
                :disabled="item.count <= 0"
              />
              <v-btn
                density="compact"
                icon="mdi-minus"
                size="x-small"
                @click="adjustCapturedUnrevealedCount(item.char, -1)"
                :disabled="item.capturedCount <= 0"
              />
            </div>
          </div>
        </div>
      </div>
    </DraggablePanel>

    <DraggablePanel
      v-if="!isHumanVsAiMode || showEngineAnalysis"
      panel-id="engine-analysis"
    >
      <template #header>
        <div class="d-flex align-center justify-space-between flex-grow-1" style="min-height: 24px;">
          <h3 class="ma-0">
            {{
              isMatchMode
                ? $t('analysis.matchInfo')
                : $t('analysis.engineAnalysis')
            }}
          </h3>
          <div v-if="!isMatchMode" class="d-flex align-center">
            <v-checkbox
              v-model="isAnalysisActive"
              :disabled="!isEngineLoaded"
              color="success"
              density="compact"
              hide-details
              class="ma-0 pa-0 analysis-checkbox"
              style="transform: scale(0.9);"
            >
              <template v-slot:label>
                <span class="text-caption font-weight-bold ml-1" :class="isAnalysisActive ? 'text-success' : 'text-grey'">
                  {{ isAnalysisActive ? 'BẬT' : 'TẮT' }}
                </span>
              </template>
            </v-checkbox>
          </div>
        </div>
      </template>

      <div v-if="isMatchMode" class="match-output">
        <div v-if="jaiEngine?.isEngineLoaded?.value" class="match-info">
          <div class="match-status">
            <div class="status-line">
              <span class="label">{{ $t('analysis.matchStatus') }}:</span>
              <span class="value">{{
                jaiEngine?.isMatchRunning?.value
                  ? $t('analysis.running')
                  : $t('analysis.stopped')
              }}</span>
            </div>
            <div v-if="jaiEngine?.currentGame?.value > 0" class="status-line">
              <span class="label">{{ $t('analysis.gameProgress') }}:</span>
              <span class="value"
                >{{ jaiEngine.currentGame.value }} /
                {{ jaiEngine.totalGames.value }}</span
              >
            </div>
            <div v-if="jaiEngine?.matchEngineInfo?.value" class="status-line">
              <span class="label">{{ $t('analysis.engineInfo') }}:</span>
              <span class="value">{{ jaiEngine.matchEngineInfo.value }}</span>
            </div>
            <div v-if="jaiEngine?.matchResult?.value" class="status-line">
              <span class="label">{{ $t('analysis.lastResult') }}:</span>
              <span class="value">{{ jaiEngine.matchResult.value }}</span>
            </div>
            <div
              v-if="
                jaiEngine?.matchWins?.value > 0 ||
                jaiEngine?.matchLosses?.value > 0 ||
                jaiEngine?.matchDraws?.value > 0
              "
              class="status-line"
            >
              <span class="label">{{ $t('analysis.matchWld') }}:</span>
              <span class="value"
                >{{ jaiEngine.matchWins.value }}-{{
                  jaiEngine.matchLosses.value
                }}-{{ jaiEngine.matchDraws.value }}</span
              >
            </div>
            <div v-if="matchEloDisplay" class="status-line">
              <span class="label">{{ $t('analysis.eloRating') }}:</span>
              <span class="value">{{ matchEloDisplay }}</span>
            </div>

            <div
              v-if="
                jaiEngine?.redEngine?.value || jaiEngine?.blackEngine?.value
              "
              class="status-line"
            >
              <span class="label">{{ $t('analysis.matchEngines') }}:</span>
              <span class="value"
                >{{ jaiEngine.redEngine.value || '?' }} vs
                {{ jaiEngine.blackEngine.value || '?' }}</span
              >
            </div>
          </div>

          <div v-if="jaiEngine?.analysisInfo?.value" class="analysis-info">
            <div class="info-header">{{ $t('analysis.engineAnalysis') }}</div>
            <div
              class="analysis-line"
              v-html="parseJaiAnalysisInfo(jaiEngine.analysisInfo.value)"
            ></div>
          </div>
        </div>
        <div v-else class="no-match-info">
          {{ $t('analysis.noMatchEngine') }}
        </div>
      </div>

      <div v-else>
        <div v-if="parseUciInfo && latestParsedInfo" class="analysis-modern">
          <div class="analysis-card">
            <div class="analysis-core">
              <div class="score-badge" :class="scoreDisplay.className">
                {{ scoreDisplay.text }}
              </div>
              <div class="best-move-box">
                <div class="best-move-label">{{ $t('analysis.bestMove') }}</div>
                <div class="best-move-value">{{ bestMoveDisplay }}</div>
              </div>
            </div>

            <div class="analysis-hud">
              <div class="hud-item">
                <v-icon size="16" class="hud-icon" icon="mdi-timer-outline" />
                <span>{{ hudDisplay.time }}</span>
              </div>
              <div class="hud-item">
                <v-icon size="16" class="hud-icon" icon="mdi-flash" />
                <span>{{ hudDisplay.nps }}</span>
              </div>
              <div class="hud-item">
                <v-icon size="16" class="hud-icon" icon="mdi-stairs" />
                <span>{{ hudDisplay.depth }}</span>
              </div>
            </div>

            <div v-if="wdlBar" class="wdl-bar">
              <div
                class="wdl-segment win"
                :style="{ width: wdlBar.win + '%' }"
                :title="`${wdlBar.win.toFixed(1)}%`"
              ></div>
              <div
                class="wdl-segment draw"
                :style="{ width: wdlBar.draw + '%' }"
                :title="`${wdlBar.draw.toFixed(1)}%`"
              ></div>
              <div
                class="wdl-segment loss"
                :style="{ width: wdlBar.loss + '%' }"
                :title="`${wdlBar.loss.toFixed(1)}%`"
              ></div>

              <div class="wdl-labels">
                <div
                  v-for="item in wdlBar.labels"
                  :key="item.key"
                  class="wdl-label"
                  :style="{ left: item.left + '%' }"
                >
                  <div class="wdl-label-text">{{ item.value.toFixed(1) }}%</div>
                  <div class="wdl-label-line"></div>
                </div>
              </div>
            </div>

            <div v-if="multiPvInfos.length > 1" class="multipv-list">
              <div class="multipv-title">{{ $t('analysis.multiPv') }}</div>
              <div class="multipv-rows">
                <div
                  class="multipv-row"
                  v-for="item in multiPvInfos"
                  :key="`mpv-${item.multipv}`"
                  :class="{ active: selectedMultipv === item.multipv }"
                  @click="handleSelectMultipv(item)"
                >
                  <div class="multipv-col multipv-idx">#{{ item.multipv }}</div>
                  <div
                    class="multipv-col multipv-score"
                    :class="item.scoreClass"
                  >
                    {{ item.scoreText }}
                  </div>
                  <div class="multipv-col multipv-move">
                    {{ item.bestMove }}
                  </div>
                  <div class="multipv-col multipv-mini">
                    {{ item.depthText }}
                  </div>
                </div>
              </div>
            </div>

            <div class="analysis-pv-block">
              <div class="pv-header">
                <div class="pv-title">{{ $t('analysis.fullLine') }}</div>
                <v-btn
                  class="pv-toggle-btn"
                  size="x-small"
                  variant="text"
                  icon
                  :title="
                    isFullLineCollapsed
                      ? $t('openingBook.showMore')
                      : $t('openingBook.showLess')
                  "
                  @click="isFullLineCollapsed = !isFullLineCollapsed"
                >
                  <v-icon
                    size="18"
                    :icon="
                      isFullLineCollapsed
                        ? 'mdi-chevron-down'
                        : 'mdi-chevron-up'
                    "
                  />
                </v-btn>
              </div>
              <div v-show="!isFullLineCollapsed" class="pv-body">
                <div class="pv-text">{{ pvDisplay }}</div>
                <div v-if="extraInfoDisplay" class="extra-info">
                  {{ extraInfoDisplay }}
                </div>
              </div>
            </div>
          </div>
        </div>
        <div v-else class="analysis-output">
          <div
            v-for="(ln, idx) in parsedAnalysisLines"
            :key="`an-${idx}`"
            v-html="ln"
          ></div>
        </div>
      </div>
    </DraggablePanel>

    <DraggablePanel v-if="showOpeningBookPanel" panel-id="opening-book">
      <template #header>
        <h3>{{ $t('openingBook.title') }}</h3>
      </template>
      <OpeningBookPanel
        :show-panel="true"
        @open-detail-dialog="showOpeningBookDetail = true"
        @play-move="handleOpeningBookMove"
      />
    </DraggablePanel>

    <DraggablePanel panel-id="notation">
      <template #header>
        <div class="notation-header">
          <h3>{{ $t('analysis.notation') }}</h3>
          <div class="notation-controls">
            <v-btn
              @click="goToFirstMove"
              :disabled="currentMoveIndex <= 0 || isMatchRunning"
              icon="mdi-skip-backward"
              size="x-small"
              color="primary"
              variant="text"
              :title="$t('analysis.goToFirst')"
            />
            <v-btn
              @click="goToPreviousMove"
              :disabled="currentMoveIndex <= 0 || isMatchRunning"
              icon="mdi-step-backward"
              size="x-small"
              color="primary"
              variant="text"
              :title="$t('analysis.goToPrevious')"
            />
            <v-btn
              @click="togglePlayPause"
              :color="isPlaying ? 'warning' : 'success'"
              :icon="isPlaying ? 'mdi-pause' : 'mdi-play'"
              size="x-small"
              variant="text"
              :disabled="isMatchRunning"
              :title="isPlaying ? $t('analysis.pause') : $t('analysis.play')"
            />
            <v-btn
              @click="goToNextMove"
              :disabled="currentMoveIndex >= history.length || isMatchRunning"
              icon="mdi-step-forward"
              size="x-small"
              color="primary"
              variant="text"
              :title="$t('analysis.goToNext')"
            />
            <v-btn
              @click="goToLastMove"
              :disabled="currentMoveIndex >= history.length || isMatchRunning"
              icon="mdi-skip-forward"
              size="x-small"
              color="primary"
              variant="text"
              :title="$t('analysis.goToLast')"
            />
            <v-menu location="bottom" :close-on-content-click="true">
              <template #activator="{ props }">
                <v-btn
                  v-bind="props"
                  size="x-small"
                  color="indigo"
                  variant="text"
                  icon="mdi-star-circle"
                  :title="$t('analysis.annotateMove')"
                />
              </template>
              <v-list density="compact">
                <v-list-item @click="setAnnotation('!!')"
                  ><v-list-item-title
                    >!! {{ $t('analysis.brilliant') }}</v-list-item-title
                  ></v-list-item
                >
                <v-list-item @click="setAnnotation('!')"
                  ><v-list-item-title
                    >! {{ $t('analysis.good') }}</v-list-item-title
                  ></v-list-item
                >
                <v-list-item @click="setAnnotation('!?')"
                  ><v-list-item-title
                    >!? {{ $t('analysis.interesting') }}</v-list-item-title
                  ></v-list-item
                >
                <v-list-item @click="setAnnotation('?!')"
                  ><v-list-item-title
                    >?! {{ $t('analysis.dubious') }}</v-list-item-title
                  ></v-list-item
                >
                <v-list-item @click="setAnnotation('?')"
                  ><v-list-item-title
                    >? {{ $t('analysis.mistake') }}</v-list-item-title
                  ></v-list-item
                >
                <v-list-item @click="setAnnotation('??')"
                  ><v-list-item-title
                    >?? {{ $t('analysis.blunder') }}</v-list-item-title
                  ></v-list-item
                >
                <v-list-item @click="setAnnotation(undefined)"
                  ><v-list-item-title>{{
                    $t('analysis.clear')
                  }}</v-list-item-title></v-list-item
                >
              </v-list>
            </v-menu>
          </div>
        </div>
      </template>
      <div
        class="move-list"
        ref="moveListElement"
        :class="{ 'disabled-clicks': isMatchRunning }"
      >
        <div
          class="move-item"
          :class="{ 'current-move': currentMoveIndex === 0 }"
          @click="handleMoveClick(0)"
        >
          <span class="move-number">{{ $t('analysis.opening') }}</span>
        </div>
        <div
          v-for="(entry, idx) in history"
          :key="idx"
          class="move-item"
          :class="{ 'current-move': currentMoveIndex === idx + 1 }"
          @click="handleMoveClick(idx + 1)"
        >
          <template v-if="entry.type === 'move'">
            <span class="move-number">{{ getMoveNumber(idx) }}</span>
            <span class="move-uci">{{
              isHumanVsAiMode ? entry.data.slice(0, 4) : entry.data
            }}</span>
            <span
              v-if="entry.annotation"
              class="move-annot"
              :class="annotationClass(entry.annotation)"
              >{{ entry.annotation }}</span
            >
            <span v-if="showChineseNotation" class="move-chinese">
              {{ getChineseNotationForMove(idx) }}
            </span>
            <div
              v-if="
                !isHumanVsAiMode &&
                (entry.engineScore !== undefined ||
                  entry.engineTime !== undefined)
              "
              class="engine-analysis"
            >
              <span
                v-if="entry.engineScore !== undefined"
                class="engine-score"
                :class="getScoreClass(entry.engineScore)"
              >
                {{ formatScore(entry.engineScore) }}
              </span>
              <span v-if="entry.engineTime !== undefined" class="engine-time">
                {{ formatTime(entry.engineTime) }}
              </span>
            </div>
          </template>
          <template v-else-if="entry.type === 'adjust'">
            <span class="move-adjust"
              >{{ $t('analysis.adjustment') }}: {{ entry.data }}</span
            >
          </template>
        </div>
      </div>
    </DraggablePanel>

    <DraggablePanel panel-id="move-comments">
      <template #header>
        <h3>{{ $t('analysis.moveComments') }}</h3>
      </template>
      <div class="comments-list" ref="commentsListElement">
        <div
          class="comment-item"
          :class="{ 'current-comment': currentMoveIndex === 0 }"
        >
          <div class="comment-header">
            <span class="comment-number">{{ $t('analysis.opening') }}</span>
            <v-btn
              density="compact"
              icon="mdi-pencil"
              size="x-small"
              @click="editComment(0)"
              color="primary"
              variant="text"
            />
          </div>
          <div v-if="editingCommentIndex === 0" class="comment-edit">
            <div class="comment-toolbar">
              <v-btn
                size="x-small"
                variant="text"
                icon="mdi-format-bold"
                @click="surroundSelection(0, '**', '**')"
              />
              <v-btn
                size="x-small"
                variant="text"
                icon="mdi-format-italic"
                @click="surroundSelection(0, '*', '*')"
              />
              <v-btn
                size="x-small"
                variant="text"
                icon="mdi-format-underline"
                @click="surroundSelection(0, '<u>', '</u>')"
              />
              <v-btn
                size="x-small"
                variant="text"
                icon="mdi-format-strikethrough"
                @click="surroundSelection(0, '~~', '~~')"
              />
              <v-btn size="x-small" variant="text" @click="applyHeading(0, 1)"
                >H1</v-btn
              >
              <v-btn size="x-small" variant="text" @click="applyHeading(0, 2)"
                >H2</v-btn
              >
              <v-btn size="x-small" variant="text" @click="applyHeading(0, 3)"
                >H3</v-btn
              >
              <v-btn size="x-small" variant="text" @click="applyHeading(0, 4)"
                >H4</v-btn
              >
              <v-btn
                size="x-small"
                variant="text"
                icon="mdi-link-variant"
                @click="insertLink(0)"
              />
              <v-btn
                size="x-small"
                variant="text"
                icon="mdi-format-clear"
                @click="clearFormatting(0)"
              />
            </div>
            <v-textarea
              :ref="el => setCommentTextareaRef(0, el)"
              v-model="editingCommentText"
              auto-grow
              rows="2"
              density="compact"
              hide-details
              :placeholder="$t('analysis.enterComment')"
              @keyup.enter.ctrl.exact="saveComment"
              @keyup.esc="cancelEdit"
            />
            <div class="comment-edit-buttons">
              <v-btn size="x-small" @click="saveComment" color="success">{{
                $t('analysis.saveComment')
              }}</v-btn>
              <v-btn size="x-small" @click="cancelEdit" color="error">{{
                $t('analysis.cancelComment')
              }}</v-btn>
            </div>
          </div>
          <div
            v-else
            class="comment-text"
            v-html="getCommentHtmlWithFallback(0)"
          ></div>
        </div>
        <div
          v-for="(_, idx) in history"
          :key="`comment-${idx}`"
          class="comment-item"
          :class="{ 'current-comment': currentMoveIndex === idx + 1 }"
        >
          <div class="comment-header">
            <span class="comment-number">{{ getMoveNumber(idx) }}</span>
            <v-btn
              density="compact"
              icon="mdi-pencil"
              size="x-small"
              @click="editComment(idx + 1)"
              color="primary"
              variant="text"
            />
          </div>
          <div v-if="editingCommentIndex === idx + 1" class="comment-edit">
            <div class="comment-toolbar">
              <v-btn
                size="x-small"
                variant="text"
                icon="mdi-format-bold"
                @click="surroundSelection(idx + 1, '**', '**')"
              />
              <v-btn
                size="x-small"
                variant="text"
                icon="mdi-format-italic"
                @click="surroundSelection(idx + 1, '*', '*')"
              />
              <v-btn
                size="x-small"
                variant="text"
                icon="mdi-format-underline"
                @click="surroundSelection(idx + 1, '<u>', '</u>')"
              />
              <v-btn
                size="x-small"
                variant="text"
                icon="mdi-format-strikethrough"
                @click="surroundSelection(idx + 1, '~~', '~~')"
              />
              <v-btn
                size="x-small"
                variant="text"
                @click="applyHeading(idx + 1, 1)"
                >H1</v-btn
              >
              <v-btn
                size="x-small"
                variant="text"
                @click="applyHeading(idx + 1, 2)"
                >H2</v-btn
              >
              <v-btn
                size="x-small"
                variant="text"
                @click="applyHeading(idx + 1, 3)"
                >H3</v-btn
              >
              <v-btn
                size="x-small"
                variant="text"
                @click="applyHeading(idx + 1, 4)"
                >H4</v-btn
              >
              <v-btn
                size="x-small"
                variant="text"
                icon="mdi-link-variant"
                @click="insertLink(idx + 1)"
              />
              <v-btn
                size="x-small"
                variant="text"
                icon="mdi-format-clear"
                @click="clearFormatting(idx + 1)"
              />
            </div>
            <v-textarea
              :ref="el => setCommentTextareaRef(idx + 1, el)"
              v-model="editingCommentText"
              auto-grow
              rows="2"
              density="compact"
              hide-details
              :placeholder="$t('analysis.enterComment')"
              @keyup.enter.ctrl.exact="saveComment"
              @keyup.esc="cancelEdit"
            />
            <div class="comment-edit-buttons">
              <v-btn size="x-small" @click="saveComment" color="success">{{
                $t('analysis.saveComment')
              }}</v-btn>
              <v-btn size="x-small" @click="cancelEdit" color="error">{{
                $t('analysis.cancelComment')
              }}</v-btn>
            </div>
          </div>
          <div
            v-else
            class="comment-text"
            v-html="getCommentHtmlWithFallback(idx + 1)"
          ></div>
        </div>
      </div>
    </DraggablePanel>

    <DraggablePanel panel-id="engine-log">
      <template #header>
        <h3>{{ $t('analysis.engineLog') }}</h3>
      </template>
      <div class="engine-log" ref="engineLogElement">
        <div
          v-for="(ln, Idx) in currentEngineOutput"
          :key="Idx"
          :class="ln.kind === 'sent' ? 'line-sent' : 'line-recv'"
        >
          {{ ln.text }}
        </div>
      </div>
    </DraggablePanel>

    <div class="uci-terminal-section">
      <v-btn
        @click="showUciTerminalDialog = true"
        :disabled="!isEngineLoaded"
        color="purple"
        variant="outlined"
        class="full-btn"
        size="small"
        prepend-icon="mdi-console"
      >
        {{ $t('analysis.uciTerminal') }}
      </v-btn>
    </div>

    <div class="about-section">
      <v-btn
        @click="openAboutDialog"
        color="info"
        variant="outlined"
        class="full-btn"
        size="small"
        prepend-icon="mdi-information"
      >
        {{ $t('analysis.about') }}
      </v-btn>
    </div>

    <AboutDialog ref="aboutDialogRef" />
    <EngineManagerDialog v-model="showEngineManager" />
    <UciTerminalDialog v-model="showUciTerminalDialog" />
    <JaiOptionsDialog
      v-if="isMatchMode"
      v-model="showJaiOptionsDialog"
      :engine-id="currentJaiEngineId"
    />
    <EloCalculatorDialog
      v-model="showEloCalculatorDialog"
      :initial-wins="jaiEngine?.matchWins?.value || 0"
      :initial-losses="jaiEngine?.matchLosses?.value || 0"
      :initial-draws="jaiEngine?.matchDraws?.value || 0"
    />
    <HumanVsAiModeDialog
      v-model="showHumanVsAiDialog"
      @confirm="handleHumanVsAiModeConfirm"
    />
    <OpeningBookDialog v-model="showOpeningBookDetail" />
  </div>
</template>

<script setup lang="ts">
// ... (imports giữ nguyên)
import {
  computed,
  inject,
  ref,
  watch,
  nextTick,
  onMounted,
  onUnmounted,
} from 'vue'
import { useI18n } from 'vue-i18n'
// ... (các import khác giữ nguyên)
import type { HistoryEntry } from '@/composables/useChessGame'
import { useInterfaceSettings } from '@/composables/useInterfaceSettings'
import { uciToChineseMoves } from '@/utils/chineseNotation'
import { useGameSettings } from '@/composables/useGameSettings'
import { useHumanVsAiSettings } from '@/composables/useHumanVsAiSettings'
import AboutDialog from './AboutDialog.vue'
import EngineManagerDialog from './EngineManagerDialog.vue'
import UciTerminalDialog from './UciTerminalDialog.vue'
import JaiOptionsDialog from './JaiOptionsDialog.vue'
import EloCalculatorDialog from './EloCalculatorDialog.vue'
import HumanVsAiModeDialog from './HumanVsAiModeDialog.vue'
import CaptureHistoryPanel from './CaptureHistoryPanel.vue'
import OpeningBookPanel from './OpeningBookPanel.vue'
import OpeningBookDialog from './OpeningBookDialog.vue'
import {
  useConfigManager,
  type ManagedEngine,
} from '@/composables/useConfigManager'
import DraggablePanel from './DraggablePanel.vue'
import { usePanelManager } from '@/composables/usePanelManager'
import {
  calculateEloRating,
  formatEloRating,
  formatErrorMargin,
} from '@/utils/eloCalculator'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import {
  START_FEN,
  JIEQI_MODEL_FEATURE_DIM as FEATURE_DIM,
  JIEQI_MODEL_INTERCEPT as MODEL_INTERCEPT,
  JIEQI_MODEL_WEIGHTS as MODEL_WEIGHTS,
  JIEQI_MODEL_SCALER_MEANS as SCALER_MEANS,
  JIEQI_MODEL_SCALER_SCALES as SCALER_SCALES,
  JIEQI_MODEL_PIECE_TO_INDEX as PIECE_TO_INDEX,
  MATE_SCORE_BASE // Thêm import này nếu chưa có hoặc dùng trực tiếp từ constants
} from '@/utils/constants'

// ... (phần setup giữ nguyên) ...
const { t } = useI18n()
const { restoreDefaultLayout } = usePanelManager()
// ...

const engineState = inject('engine-state') as any
const {
  engineOutput,
  isEngineLoaded,
  isEngineLoading,
  analysis,
  bestMove,
  isThinking,
  isStopping,
  loadEngine,
  unloadEngine,
  startAnalysis,
  stopAnalysis,
  currentSearchMoves,
  isPondering,
  isInfinitePondering,
  ponderMove,
  ponderhit, // Thêm ponderhit nếu chưa có trong destructuring
  handlePonderHit,
  stopPonder,
  isPonderMoveMatch,
  isDarkPieceMove,
  setShowChineseNotation,
} = engineState

// ... (các khai báo state khác giữ nguyên) ...

/* ---------- CẬP NHẬT: Logic điều khiển phân tích ---------- */

// Computed property để liên kết checkbox với trạng thái engine
const isAnalysisActive = computed({
  get: () => isThinking.value || isPondering.value,
  set: (val: boolean) => {
    if (val) {
      // Nếu bật checkbox mà engine chưa chạy thì bắt đầu
      if (!isThinking.value && !isPondering.value) {
        manualStartAnalysis()
      }
    } else {
      // Nếu tắt checkbox mà engine đang chạy thì dừng
      if (isThinking.value || isPondering.value) {
        handleStopAnalysis()
      }
    }
  },
})

// Hàm bắt đầu phân tích thủ công (giữ nguyên logic nhưng sửa đổi để phù hợp với checkbox)
function manualStartAnalysis() {
  isRedAi.value = false
  isBlackAi.value = false
  isManualAnalysis.value = true

  // Dừng ponder nếu đang chạy
  if (isPondering.value) {
    stopPonder({ playBestMoveOnStop: false })
  }

  const infiniteAnalysisSettings = {
    movetime: 0,
    maxThinkTime: 0,
    maxDepth: 0,
    maxNodes: 0,
    analysisMode: 'infinite',
  }
  
  // Ghi lại ngữ cảnh lúc bắt đầu phân tích
  lastAnalysisFen.value = baseFenForEngine.value
  lastAnalysisPrefixMoves.value = [...engineMovesSinceLastReveal.value]

  startAnalysis(
    infiniteAnalysisSettings,
    engineMovesSinceLastReveal.value,
    baseFenForEngine.value,
    currentSearchMoves.value
  )
}

// Hàm dừng phân tích
function handleStopAnalysis() {
  if (isPondering.value) {
    if (ponderhit?.value) {
      stopPonder({ playBestMoveOnStop: true })
    } else {
      stopPonder({ playBestMoveOnStop: false })
    }
    return
  }

  // Nếu đang Auto AI thì dừng và đi nước tốt nhất
  if (isRedAi.value || isBlackAi.value) {
    stopAnalysis({ playBestMoveOnStop: true })
  } else {
    // Nếu phân tích thủ công thì chỉ dừng
    stopAnalysis({ playBestMoveOnStop: false })
  }
  isManualAnalysis.value = false
}

// ... (Phần còn lại giữ nguyên) ...
</script>

<style lang="scss">
/* ... (style cũ) ... */

/* Thêm style cho checkbox phân tích để căn chỉnh đẹp hơn */
.analysis-checkbox {
  margin: 0 !important;
  padding: 0 !important;
}

.analysis-checkbox .v-label {
  font-size: 0.75rem !important;
  opacity: 1 !important;
}

.text-success {
  color: #4caf50 !important;
}

.text-grey {
  color: #9e9e9e !important;
}
</style>