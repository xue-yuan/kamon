export default {
    multipass: true,
    plugins: [
        'preset-default',
        'removeDimensions',
        'convertStyleToAttrs',
        'removeScripts',
        'sortAttrs',
        'moveGroupAttrsToElems',
        'collapseGroups',
        {
            name: 'convertPathData',
            params: {
                forceAbsolutePath: true,
            }
        },
        {
            name: 'convertShapeToPath',
            params: {
                convertArcs: true
            }
        },
        'mergePaths',
    ]
};
