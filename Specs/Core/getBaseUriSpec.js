/*global defineSuite*/
defineSuite([
        'Core/getBaseUri'
    ], function(
        getBaseUri) {
    "use strict";
    /*global jasmine,describe,xdescribe,it,xit,expect,beforeEach,afterEach,beforeAll,afterAll,spyOn*/

    it('works as expected', function() {
        var result = getBaseUri('http://www.mysite.com/awesome?makeitawesome=true');
        expect(result).toEqual('http://www.mysite.com/');

        result = getBaseUri('http://www.mysite.com/somefolder/awesome.png#makeitawesome');
        expect(result).toEqual('http://www.mysite.com/somefolder/');
    });

    it('throws with undefined parameter', function() {
        expect(function() {
            getBaseUri(undefined);
        }).toThrowDeveloperError();
    });
});
