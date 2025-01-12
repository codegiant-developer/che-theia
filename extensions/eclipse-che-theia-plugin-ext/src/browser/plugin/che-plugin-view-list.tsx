/**********************************************************************
 * Copyright (c) 2018-2022 Red Hat, Inc.
 *
 * This program and the accompanying materials are made
 * available under the terms of the Eclipse Public License 2.0
 * which is available at https://www.eclipse.org/legal/epl-2.0/
 *
 * SPDX-License-Identifier: EPL-2.0
 ***********************************************************************/

import * as React from 'react';
import { ChePlugin, ChePluginManager, ChePluginStatus } from './che-plugin-manager';
import { ChePluginMetadata } from '@eclipse-che/theia-remote-api/lib/common/plugin-service';
import { AutoSizer, List, ListRowRenderer } from '@theia/core/shared/react-virtualized';

interface ListProps {
    pluginManager: ChePluginManager;
    plugins: ChePlugin[];
    highlighters: string[];
}

interface ListState {
}

export class ChePluginViewList extends React.Component<ListProps, ListState> {

    constructor(props: ListProps) {
        super(props);
    }

    protected renderRow: ListRowRenderer = ({ index, key, style }) => {
        const plugin = this.props.plugins[index];
        
        return (
            <div key={key} style={style}>
                <ChePluginListItem
                    key={plugin.publisher + '/' + plugin.name}
                    pluginItem={plugin}
                    pluginManager={this.props.pluginManager}
                    highlighters={this.props.highlighters} />
            </div>
        );
    };

    render(): React.ReactNode {
        return <div className='che-plugin-list'>
            <AutoSizer>
                {
                    ({ width, height }) => <List
                            width={width}
                            height={height}
                            rowHeight={104}
                            rowCount={this.props.plugins.length}
                            rowRenderer={this.renderRow}
                        />
                }
            </AutoSizer>
        </div>;
    }

}

interface ListItemProps {
    pluginManager: ChePluginManager;
    pluginItem: ChePlugin;
    highlighters: string[];
}

interface ListItemState {
    pluginStatus: ChePluginStatus;
    iconFailed: boolean;
}

export class ChePluginListItem extends React.Component<ListItemProps, ListItemState> {

    constructor(props: ListItemProps) {
        super(props);
        const status = props.pluginItem.status;
        this.state = {
            pluginStatus: status,
            iconFailed: false
        };
    }

    getMask(text: string, highlighters: string[]): boolean[] {
        // create and initialize mask
        const mask: boolean[] = [];
        for (let i = 0; i < text.length; i++) {
            mask[i] = false;
        }

        highlighters.forEach(query => {
            query = query.toLowerCase();

            let workingText = text;
            let highlightIndex = 0;

            while (workingText) {
                const index = workingText.toLowerCase().indexOf(query);

                if (index === 0) {
                    // text is started with query string

                    // update text
                    workingText = workingText.substring(query.length);

                    for (let i = 0; i < query.length; i++) {
                        // update mask
                        mask[highlightIndex] = true;
                        // shift index
                        highlightIndex++;
                    }
                } else if (index > 0) {
                    // some text is present before query string

                    // update text
                    workingText = workingText.substring(index);

                    // shift index
                    highlightIndex += index;

                } else {
                    // do not highlight
                    break;
                }
            }

        });

        return mask;
    }

    getHighlightedPieces(text: string, mask: boolean[]): React.ReactNode[] {
        const pieces: React.ReactNode[] = [];

        if (!text) {
            return pieces;
        }

        let highlight = mask[0];

        let pieceStart = 0;
        let pieceEnd = 1;

        for (let i = 1; i < text.length; i++) {
            if (highlight === mask[i]) {
                pieceEnd++;
            } else {
                if (i === 0) {
                    pieceEnd++;
                    continue;
                }

                const piece = text.substring(pieceStart, pieceEnd);
                if (highlight) {
                    pieces.push(<span className='highlighted'>{piece}</span>);
                } else {
                    pieces.push(<span>{piece}</span>);
                }

                highlight = mask[i];
                pieceStart = i;
                pieceEnd = i + 1;
            }
        }

        const finalPiece = text.substring(pieceStart, pieceEnd);
        if (highlight) {
            pieces.push(<span className='highlighted'>{finalPiece}</span>);
        } else {
            pieces.push(<span>{finalPiece}</span>);
        }

        return pieces;
    }

    /**
     * Highlights found text
     */
    highlight(text: string): React.ReactNode[] {
        try {
            if (this.props.highlighters.length === 0) {
                return [<span>{text}</span>];
            }

            if (!text) {
                return [<span></span>];
            }

            const mask = this.getMask(text, this.props.highlighters);
            return this.getHighlightedPieces(text, mask);
        } catch (error) {
            console.log(error);
        }

        return [<span>{text}</span>];
    }

    componentDidUpdate(): void {
        const plugin = this.props.pluginItem;

        // align state with plugin.status
        if (plugin.status !== this.state.pluginStatus) {
            this.setState({
                pluginStatus: plugin.status,
                iconFailed: this.state.iconFailed
            });
        }
    }

    render(): React.ReactNode {
        const plugin = this.props.pluginItem;
        const metadata = plugin.versionList[plugin.version];

        if (!metadata) {
            return undefined;
        }

        return <div key={plugin.publisher + '/' + plugin.name} className='che-plugin'>
            <div className='che-plugin-content'>
                {this.renderIcon(metadata)}
                <div className='che-plugin-info'>
                    <div className='che-plugin-title'>
                        <div className='che-plugin-name'>{this.highlight(metadata.name)}</div>
                        {this.renderPluginVersion()}
                    </div>
                    <div className='che-plugin-description'>
                        <div>
                            <div>{this.highlight(metadata.description)}</div>
                        </div>
                    </div>
                    <div className='che-plugin-publisher'>
                        {this.highlight(metadata.publisher)}
                        <span className='che-plugin-type'>{metadata.type}</span>
                    </div>
                    {this.renderAction()}
                </div>
            </div>
        </div>;
    }

    protected renderPluginVersion(): React.ReactNode {
        const plugin = this.props.pluginItem;

        const versions: string[] = [];
        Object.keys(plugin.versionList).forEach(version => versions.push(version));
        versions.reverse();

        return <select className='che-plugin-version' onChange={this.versionChanged} >
            {
                versions.map(version => {
                    if (version === plugin.version) {
                        return <option value={version} selected>{version}</option>;
                    } else {
                        return <option value={version}>{version}</option>;
                    }
                })
            }
        </select>;
    }

    protected onIconFailed = async () => {
        const plugin = this.props.pluginItem;
        const metadata = plugin.versionList[plugin.version];
        if (metadata) {
            this.setState({
                pluginStatus: this.state.pluginStatus,
                iconFailed: true
            });
        }
    };

    protected renderIcon(metadata: ChePluginMetadata): React.ReactNode {
        if (!this.state.iconFailed && metadata.icon) {
            // return the icon
            return <div className='che-plugin-icon'>
                <img src={metadata.icon} onError={this.onIconFailed}></img>
            </div>;
        }

        // return default icon
        return <div className='che-plugin-default-icon'>
            <div className='fa fa-puzzle-piece fa-2x fa-fw'></div>
        </div>;
    }

    protected renderAction(): React.ReactNode {
        const plugin = this.props.pluginItem;
        const metadata = plugin.versionList[plugin.version];

        // Don't show the button for 'Che Editor' plugins and for built-in plugins
        if ('Che Editor' === metadata.type || metadata.builtIn) {
            return undefined;
        }

        switch (this.state.pluginStatus) {
            case 'installed':
                return <div className='che-plugin-action-installed' onClick={this.removePlugin}>Installed</div>;
            case 'installing':
                return <div className='che-plugin-action-installing'>Installing...</div>;
            case 'removing':
                return <div className='che-plugin-action-removing'>Removing...</div>;
            case 'to_be_installed':
                return <div className='che-plugin-action-to-be-installed' onClick={this.undoInstall}>To be Installed</div>;
            case 'to_be_removed':
                return <div className='che-plugin-action-to-be-removed' onClick={this.undoRemove}>To be Removed</div>;
            case 'cancelling_installation':
                return <div className='che-plugin-action-removing'>Cancelling...</div>;
            case 'cancelling_removal':
                return <div className='che-plugin-action-installing'>Cancelling...</div>;
            }

        // 'not_installed'
        return <div className='che-plugin-action-install' onClick={this.installPlugin}>Install</div>;
    }

    protected setStatus(status: ChePluginStatus): void {
        this.props.pluginItem.status = status;

        this.setState({
            pluginStatus: status,
            iconFailed: this.state.iconFailed
        });
    }

    protected installPlugin = async () => {
        const previousStatus = this.state.pluginStatus;
        this.setStatus('installing');

        const installed = await this.props.pluginManager.install(this.props.pluginItem);

        if (this.props.pluginManager.isDeferredInstallation()) {
            this.setStatus(installed ? 'to_be_installed' : previousStatus);
        } else {
            this.setStatus(installed ? 'installed' : previousStatus);
        }
    };

    protected undoInstall = async () => {
        const previousStatus = this.state.pluginStatus;
        this.setStatus('cancelling_installation');

        const cancelled = await this.props.pluginManager.undoInstall(this.props.pluginItem);
        this.setStatus(cancelled ? 'not_installed' : previousStatus);
    };

    protected removePlugin = async () => {
        const previousStatus = this.state.pluginStatus;
        this.setStatus('removing');

        const removed = await this.props.pluginManager.remove(this.props.pluginItem);

        if (!removed) {
            this.setStatus(previousStatus);
            return;
        }

        if (this.props.pluginManager.isDeferredInstallation()) {
            this.setStatus('to_be_removed');
        } else {
            this.setStatus('not_installed');
        }
    };

    protected undoRemove = async () => {
        const previousStatus = this.state.pluginStatus;
        this.setStatus('cancelling_removal');

        const cancelled = await this.props.pluginManager.undoRemove(this.props.pluginItem);
        this.setStatus(cancelled ? 'installed' : previousStatus);
    };

    protected versionChanged = async (event: React.ChangeEvent<HTMLSelectElement>) => {
        const select: HTMLSelectElement = (window.event as Event).target as HTMLSelectElement;

        const plugin = this.props.pluginItem;
        const versionBefore = plugin.version;

        plugin.version = select.value;

        this.setState({
            pluginStatus: this.state.pluginStatus
        });

        if (plugin.status === 'installed') {
            await this.props.pluginManager.changeVersion(this.props.pluginItem, versionBefore);
        }
    };

}
