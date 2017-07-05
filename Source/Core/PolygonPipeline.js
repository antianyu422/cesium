define([
        '../ThirdParty/earcut-2.1.1',
        './Cartesian2',
        './Cartesian3',
        './ComponentDatatype',
        './defaultValue',
        './defined',
        './DeveloperError',
        './Ellipsoid',
        './Geometry',
        './GeometryAttribute',
        './Math',
        './PrimitiveType',
        './WindingOrder'
    ], function(
        earcut,
        Cartesian2,
        Cartesian3,
        ComponentDatatype,
        defaultValue,
        defined,
        DeveloperError,
        Ellipsoid,
        Geometry,
        GeometryAttribute,
        CesiumMath,
        PrimitiveType,
        WindingOrder) {
    'use strict';

    var scaleToGeodeticHeightN = new Cartesian3();
    var scaleToGeodeticHeightP = new Cartesian3();

    /**
     * @private
     */
    var PolygonPipeline = {};

    /**
     * @exception {DeveloperError} At least three positions are required.
     */
    PolygonPipeline.computeArea2D = function(positions) {
        //>>includeStart('debug', pragmas.debug);
        if (!defined(positions)) {
            throw new DeveloperError('positions is required.');
        }
        if (positions.length < 3) {
            throw new DeveloperError('At least three positions are required.');
        }
        //>>includeEnd('debug');

        var length = positions.length;
        var area = 0.0;

        for ( var i0 = length - 1, i1 = 0; i1 < length; i0 = i1++) {
            var v0 = positions[i0];
            var v1 = positions[i1];

            area += (v0.x * v1.y) - (v1.x * v0.y);
        }

        return area * 0.5;
    };

    /**
     * @returns {WindingOrder} The winding order.
     *
     * @exception {DeveloperError} At least three positions are required.
     */
    PolygonPipeline.computeWindingOrder2D = function(positions) {
        var area = PolygonPipeline.computeArea2D(positions);
        return (area > 0.0) ? WindingOrder.COUNTER_CLOCKWISE : WindingOrder.CLOCKWISE;
    };

    /**
     * Triangulate a polygon.
     *
     * @param {Cartesian2[]} positions Cartesian2 array containing the vertices of the polygon
     * @param {Number[]} [holes] An array of the staring indices of the holes.
     * @returns {Number[]} Index array representing triangles that fill the polygon
     */
    PolygonPipeline.triangulate = function(positions, holes) {
        //>>includeStart('debug', pragmas.debug);
        if (!defined(positions)) {
            throw new DeveloperError('positions is required.');
        }
        //>>includeEnd('debug');

        var flattenedPositions = Cartesian2.packArray(positions);
        return earcut(flattenedPositions, holes, 2);
    };

    var subdivisionV0Scratch = new Cartesian3();
    var subdivisionV1Scratch = new Cartesian3();
    var subdivisionV2Scratch = new Cartesian3();
    var subdivisionS0Scratch = new Cartesian3();
    var subdivisionS1Scratch = new Cartesian3();
    var subdivisionS2Scratch = new Cartesian3();
    var subdivisionMidScratch = new Cartesian3();

    /**
     * Subdivides positions and raises points to the surface of the ellipsoid.
     *
     * @param {Ellipsoid} ellipsoid The ellipsoid the polygon in on.
     * @param {Cartesian3[]} positions An array of {@link Cartesian3} positions of the polygon.
     * @param {Number[]} indices An array of indices that determines the triangles in the polygon.
     * @param {Number} [granularity=CesiumMath.RADIANS_PER_DEGREE] The distance, in radians, between each latitude and longitude. Determines the number of positions in the buffer.
     *
     * @exception {DeveloperError} At least three indices are required.
     * @exception {DeveloperError} The number of indices must be divisable by three.
     * @exception {DeveloperError} Granularity must be greater than zero.
     */
    PolygonPipeline.computeSubdivision = function(ellipsoid, positions, indices, granularity) {
        granularity = defaultValue(granularity, CesiumMath.RADIANS_PER_DEGREE);

        //>>includeStart('debug', pragmas.debug);
        if (!defined(ellipsoid)) {
            throw new DeveloperError('ellipsoid is required.');
        }
        if (!defined(positions)) {
            throw new DeveloperError('positions is required.');
        }
        if (!defined(indices)) {
            throw new DeveloperError('indices is required.');
        }
        if (indices.length < 3) {
            throw new DeveloperError('At least three indices are required.');
        }
        if (indices.length % 3 !== 0) {
            throw new DeveloperError('The number of indices must be divisable by three.');
        }
        if (granularity <= 0.0) {
            throw new DeveloperError('granularity must be greater than zero.');
        }
        //>>includeEnd('debug');

        // triangles that need (or might need) to be subdivided.
        var triangles = indices.slice(0);

        // New positions due to edge splits are appended to the positions list.
        var i;
        var length = positions.length;
        var subdividedPositions = new Array(length * 3);
        var q = 0;
        for (i = 0; i < length; i++) {
            var item = positions[i];
            subdividedPositions[q++] = item.x;
            subdividedPositions[q++] = item.y;
            subdividedPositions[q++] = item.z;
        }

        var subdividedIndices = [];

        // Used to make sure shared edges are not split more than once.
        var edges = {};

        var radius = ellipsoid.maximumRadius;
        var minDistance = CesiumMath.chordLength(granularity, radius);
        var minDistanceSqrd = minDistance * minDistance;

        while (triangles.length > 0) {
            var i2 = triangles.pop();
            var i1 = triangles.pop();
            var i0 = triangles.pop();

            var v0 = Cartesian3.fromArray(subdividedPositions, i0 * 3, subdivisionV0Scratch);
            var v1 = Cartesian3.fromArray(subdividedPositions, i1 * 3, subdivisionV1Scratch);
            var v2 = Cartesian3.fromArray(subdividedPositions, i2 * 3, subdivisionV2Scratch);

            var s0 = Cartesian3.multiplyByScalar(Cartesian3.normalize(v0, subdivisionS0Scratch), radius, subdivisionS0Scratch);
            var s1 = Cartesian3.multiplyByScalar(Cartesian3.normalize(v1, subdivisionS1Scratch), radius, subdivisionS1Scratch);
            var s2 = Cartesian3.multiplyByScalar(Cartesian3.normalize(v2, subdivisionS2Scratch), radius, subdivisionS2Scratch);

            var g0 = Cartesian3.magnitudeSquared(Cartesian3.subtract(s0, s1, subdivisionMidScratch));
            var g1 = Cartesian3.magnitudeSquared(Cartesian3.subtract(s1, s2, subdivisionMidScratch));
            var g2 = Cartesian3.magnitudeSquared(Cartesian3.subtract(s2, s0, subdivisionMidScratch));

            var max = Math.max(g0, g1, g2);
            var edge;
            var mid;

            // if the max length squared of a triangle edge is greater than the chord length of squared
            // of the granularity, subdivide the triangle
            if (max > minDistanceSqrd) {
                if (g0 === max) {
                    edge = Math.min(i0, i1) + ' ' + Math.max(i0, i1);

                    i = edges[edge];
                    if (!defined(i)) {
                        mid = Cartesian3.add(v0, v1, subdivisionMidScratch);
                        Cartesian3.multiplyByScalar(mid, 0.5, mid);
                        subdividedPositions.push(mid.x, mid.y, mid.z);
                        i = subdividedPositions.length / 3 - 1;
                        edges[edge] = i;
                    }

                    triangles.push(i0, i, i2);
                    triangles.push(i, i1, i2);
                } else if (g1 === max) {
                    edge = Math.min(i1, i2) + ' ' + Math.max(i1, i2);

                    i = edges[edge];
                    if (!defined(i)) {
                        mid = Cartesian3.add(v1, v2, subdivisionMidScratch);
                        Cartesian3.multiplyByScalar(mid, 0.5, mid);
                        subdividedPositions.push(mid.x, mid.y, mid.z);
                        i = subdividedPositions.length / 3 - 1;
                        edges[edge] = i;
                    }

                    triangles.push(i1, i, i0);
                    triangles.push(i, i2, i0);
                } else if (g2 === max) {
                    edge = Math.min(i2, i0) + ' ' + Math.max(i2, i0);

                    i = edges[edge];
                    if (!defined(i)) {
                        mid = Cartesian3.add(v2, v0, subdivisionMidScratch);
                        Cartesian3.multiplyByScalar(mid, 0.5, mid);
                        subdividedPositions.push(mid.x, mid.y, mid.z);
                        i = subdividedPositions.length / 3 - 1;
                        edges[edge] = i;
                    }

                    triangles.push(i2, i, i1);
                    triangles.push(i, i0, i1);
                }
            } else {
                subdividedIndices.push(i0);
                subdividedIndices.push(i1);
                subdividedIndices.push(i2);
            }
        }

        return new Geometry({
            attributes : {
                position : new GeometryAttribute({
                    componentDatatype : ComponentDatatype.DOUBLE,
                    componentsPerAttribute : 3,
                    values : subdividedPositions
                })
            },
            indices : subdividedIndices,
            primitiveType : PrimitiveType.TRIANGLES
        });
    };

    /**
     * Scales each position of a geometry's position attribute to a height, in place.
     *
     * @param {Number[]} positions The array of numbers representing the positions to be scaled
     * @param {Number} [height=0.0] The desired height to add to the positions
     * @param {Ellipsoid} [ellipsoid=Ellipsoid.WGS84] The ellipsoid on which the positions lie.
     * @param {Boolean} [scaleToSurface=true] <code>true</code> if the positions need to be scaled to the surface before the height is added.
     * @returns {Number[]} The input array of positions, scaled to height
     */
    PolygonPipeline.scaleToGeodeticHeight = function(positions, height, ellipsoid, scaleToSurface) {
        ellipsoid = defaultValue(ellipsoid, Ellipsoid.WGS84);

        var n = scaleToGeodeticHeightN;
        var p = scaleToGeodeticHeightP;

        height = defaultValue(height, 0.0);
        scaleToSurface = defaultValue(scaleToSurface, true);

        if (defined(positions)) {
            var length = positions.length;

            for ( var i = 0; i < length; i += 3) {
                Cartesian3.fromArray(positions, i, p);

                if (scaleToSurface) {
                    p = ellipsoid.scaleToGeodeticSurface(p, p);
                }

                if (height !== 0) {
                    n = ellipsoid.geodeticSurfaceNormal(p, n);

                    Cartesian3.multiplyByScalar(n, height, n);
                    Cartesian3.add(p, n, p);
                }

                positions[i] = p.x;
                positions[i + 1] = p.y;
                positions[i + 2] = p.z;
            }
        }

        return positions;
    };

    return PolygonPipeline;
});
